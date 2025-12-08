import { getDb } from '@/lib/db.mjs';

async function addUniqueConstraint() {
  const pool = getDb();
  const client = await pool.connect();

  try {
    // Check if the constraint already exists
    const checkConstraintSql = `
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'shifts'::regclass
        AND conname = 'unique_employee_date';
    `;
    const constraintResult = await client.query(checkConstraintSql);

    if (constraintResult.rows.length > 0) {
      console.log('SUCCESS: Constraint "unique_employee_date" already exists on "shifts" table.');
    } else {
      console.log('INFO: Constraint "unique_employee_date" not found, attempting to add it.');
      const addConstraintSql = `
        ALTER TABLE shifts
        ADD CONSTRAINT unique_employee_date UNIQUE (employee_id, date);
      `;
      await client.query(addConstraintSql);
      console.log('SUCCESS: Added "unique_employee_date" constraint to "shifts" table.');
    }
  } catch (error) {
    // Check if error is due to duplicate entries that violate the new constraint
    if (error.code === '23505') { // unique_violation
        console.error('ERROR: Could not add unique constraint because duplicate employee_id/date pairs exist in the shifts table.');
        console.error('Please resolve the duplicates manually before running this migration again.');
    } else {
        console.error('ERROR: An unexpected error occurred while adding the unique constraint:', error);
    }
    // We do not re-throw the error to allow other migrations to run if this one fails.
    // In a real production scenario, you might want to handle this differently.
  } finally {
    client.release();
  }
}

addUniqueConstraint();
