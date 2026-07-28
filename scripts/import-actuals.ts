import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../src/lib/db';
import { config } from 'dotenv';

// 環境変数の読み込み
config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CSVファイルのパス
const csvFilePath = path.join(__dirname, 'import_data.csv');

// ドライランモード（trueの場合はDBに書き込まずログのみ出力）
const DRY_RUN = true;

async function importActuals() {
  console.log(`Starting CSV import process... (DRY_RUN=${DRY_RUN})`);
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');

  // 一部の行で「,」の代わりに「 」が使われている行を事前処理で「,」に置換する（※先頭に見出しがある前提）
  // 3番目と4番目の要素の間にあるスペースを対象とする
  const sanitizedContent = fileContent.split('\n').map(line => {
    // 例: "516,2026-07-27,9:53 17:17" -> "516,2026-07-27,9:53,17:17"
    return line.trim().replace(/([0-9]{1,2}:[0-9]{2})\s+([0-9]{1,2}:[0-9]{2})/, '$1,$2');
  }).join('\n');

  const records = parse(sanitizedContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Loaded ${records.length} records from CSV.`);

  const stats = {
    total: records.length,
    processed: 0,
    inserted: 0,
    updated: 0,
    errors: 0
  };

  for (const record of records) {
    try {
      const employeeId = parseInt(record['従業員ID'], 10);
      const dateStr = record['日付']; // 'YYYY-MM-DD'
      const startStr = record['実績開始']; // 'H:mm'
      const endStr = record['実績終了']; // 'H:mm'

      if (isNaN(employeeId) || !dateStr || !startStr || !endStr) {
        console.warn(`[WARN] Invalid record, skipping: ${JSON.stringify(record)}`);
        stats.errors++;
        continue;
      }

      // 1. 実績開始時間の丸め処理 (15分切り上げ)
      const [startHour, startMin] = startStr.split(':').map(Number);
      const startTotalMins = startHour * 60 + startMin;
      const roundedStartMins = Math.ceil(startTotalMins / 15) * 15;
      const roundedStartStr = `${String(Math.floor(roundedStartMins / 60)).padStart(2, '0')}:${String(roundedStartMins % 60).padStart(2, '0')}`;

      // 2. 実績終了時間の丸め処理 (15分切り捨て)
      const [endHour, endMin] = endStr.split(':').map(Number);
      const endTotalMins = endHour * 60 + endMin;
      const roundedEndMins = Math.floor(endTotalMins / 15) * 15;
      const roundedEndStr = `${String(Math.floor(roundedEndMins / 60)).padStart(2, '0')}:${String(roundedEndMins % 60).padStart(2, '0')}`;

      // 3. 休憩時間の計算
      // 拘束時間が4.0時間以上なら休憩1.0時間、3.75時間以下なら0時間
      const totalWorkMins = roundedEndMins - roundedStartMins;
      const totalWorkHours = totalWorkMins / 60;
      const breakHours = totalWorkHours >= 4.0 ? 1.0 : 0.0;
      
      const breakMins = breakHours * 60;
      const actualWorkHours = (totalWorkMins - breakMins) / 60;

      // ---- DB操作 ----
      // まず、指定された日付・従業員IDの予定(shifts)が存在するか確認
      const existingShiftRes = await db.query(
        `SELECT id, hourly_wage FROM shifts WHERE employee_id = $1 AND date = $2`,
        [employeeId, dateStr]
      );

      let shiftId;
      let hourlyWage;
      let action = 'INSERT_SHIFT_AND_ACTUAL';

      if (existingShiftRes.rows.length > 0) {
        shiftId = existingShiftRes.rows[0].id;
        hourlyWage = existingShiftRes.rows[0].hourly_wage;
        
        // actual_work_hours がすでに存在するかチェック
        const existingActualRes = await db.query(
          `SELECT id FROM actual_work_hours WHERE shift_id = $1`,
          [shiftId]
        );
        
        if (existingActualRes.rows.length > 0) {
          action = 'UPDATE_ACTUAL';
        } else {
          action = 'INSERT_ACTUAL_ONLY';
        }
      } else {
        // shiftsが存在しない場合、最新の時給を取得して新規作成
        const empRes = await db.query(`SELECT hourly_wage FROM employees WHERE id = $1`, [employeeId]);
        if (empRes.rows.length === 0) {
           console.warn(`[ERROR] Employee ID ${employeeId} not found in DB. Skipping date ${dateStr}.`);
           stats.errors++;
           continue;
        }
        hourlyWage = empRes.rows[0].hourly_wage;
        
        if (!DRY_RUN) {
           const insertShiftRes = await db.query(
             `INSERT INTO shifts (employee_id, date, start_time, end_time, break_hours, hourly_wage)
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
             [employeeId, dateStr, roundedStartStr, roundedEndStr, breakHours, hourlyWage]
           );
           shiftId = insertShiftRes.rows[0].id;
        } else {
           shiftId = -1; // ダミー
        }
      }

      if (!DRY_RUN) {
        if (action === 'UPDATE_ACTUAL') {
          await db.query(
            `UPDATE actual_work_hours 
             SET start_time = $1, end_time = $2, break_hours = $3, hourly_wage = $4, updated_at = NOW()
             WHERE shift_id = $5`,
            [roundedStartStr, roundedEndStr, breakHours, hourlyWage, shiftId]
          );
          stats.updated++;
        } else { // INSERT_ACTUAL_ONLY or INSERT_SHIFT_AND_ACTUAL
          await db.query(
            `INSERT INTO actual_work_hours (shift_id, start_time, end_time, break_hours, hourly_wage)
             VALUES ($1, $2, $3, $4, $5)`,
            [shiftId, roundedStartStr, roundedEndStr, breakHours, hourlyWage]
          );
          stats.inserted++;
        }
      } else {
         console.log(`[DRY_RUN] Date: ${dateStr}, Emp: ${employeeId} | Start: ${startStr}->${roundedStartStr}, End: ${endStr}->${roundedEndStr}, Break: ${breakHours}h, Work: ${actualWorkHours}h | Action: ${action}`);
         if (action === 'UPDATE_ACTUAL') stats.updated++;
         else stats.inserted++;
      }
      
      stats.processed++;
    } catch (e) {
      console.error(`[ERROR] Failed to process record:`, record, e);
      stats.errors++;
    }
  }

  console.log(`\nImport Completed.`);
  console.log(`Total Records: ${stats.total}`);
  console.log(`Processed:     ${stats.processed}`);
  console.log(`Inserted:      ${stats.inserted}`);
  console.log(`Updated:       ${stats.updated}`);
  console.log(`Errors:        ${stats.errors}`);
  
  // スクリプト終了
  process.exit(0);
}

importActuals().catch(console.error);
