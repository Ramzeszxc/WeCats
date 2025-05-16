const { createClient } = require('@supabase/supabase-js');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Supabase connection details
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const dbPassword = process.env.DB_PASSWORD;
const dbHost = process.env.DB_HOST || 'adcsdulxwkktbcwlfmhn.supabase.co';
const dbName = process.env.DB_NAME || 'postgres';
const dbUser = process.env.DB_USER || 'postgres';
const dbPort = process.env.DB_PORT || '5432';

const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'database-backup';

const tempDir = './temp-backups';

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Main backup function
 */
async function runBackup() {
  try {

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `backup-${timestamp}.sql`;
    const tempBackupPath = path.join(tempDir, backupFilename);
    
    console.log(`Starting database backup to ${tempBackupPath}`);
    
    await createBackupFile(tempBackupPath);
    
    await uploadToSupabaseStorage(tempBackupPath, backupFilename);
    
    fs.unlinkSync(tempBackupPath);
    console.log(`Temporary backup file deleted: ${tempBackupPath}`);
    
    await manageBackupRetention();
    
    console.log('Backup process completed successfully');
    return { success: true, filename: backupFilename };
  } catch (error) {
    console.error('Backup process failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Creates a database backup file using pg_dump
 * @param {string} outputPath Path where the backup file will be saved
 * @returns {Promise<void>}
 */
function createBackupFile(outputPath) {
  return new Promise((resolve, reject) => {
    const pgDumpCmd = `PGPASSWORD="${dbPassword}" pg_dump -h ${dbHost} -U ${dbUser} -p ${dbPort} -d ${dbName} -F c -f ${outputPath}`;
    
    exec(pgDumpCmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`pg_dump error: ${error.message}`);
        return reject(error);
      }
      
      if (stderr) {
        console.warn(`pg_dump stderr: ${stderr}`);
      }
      
      console.log(`Database backup created successfully at ${outputPath}`);
      resolve();
    });
  });
}

/**
 * Uploads a file to Supabase Storage
 * @param {string} filePath Local path of the file to upload
 * @param {string} fileName Name to use in storage
 * @returns {Promise<object>} Upload result
 */
async function uploadToSupabaseStorage(filePath, fileName) {
  console.log(`Uploading backup to Supabase Storage bucket: ${storageBucket}`);
  
  const fileBuffer = fs.readFileSync(filePath);
  
  const { data, error } = await supabase
    .storage
    .from(storageBucket)
    .upload(fileName, fileBuffer, {
      contentType: 'application/octet-stream',
      upsert: false
    });
  
  if (error) {
    console.error('Error uploading to Supabase Storage:', error);
    throw error;
  }
  
  console.log('Backup uploaded successfully to Supabase Storage:', data.path);
  return data;
}

/**
 * @returns {Promise<void>}
 */
async function manageBackupRetention() {
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
  
  if (isNaN(retentionDays) || retentionDays <= 0) {
    console.log('Backup retention management skipped (invalid retention days)');
    return;
  }
  
  try {
    console.log(`Managing backup retention: keeping last ${retentionDays} days`);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const { data: files, error } = await supabase
      .storage
      .from(storageBucket)
      .list();
    
    if (error) {
      console.error('Error listing files in storage:', error);
      return;
    }
    
    const oldBackups = files.filter(file => {
      try {
        if (!file.name.startsWith('backup-')) return false;
        
        const dateStr = file.name.replace('backup-', '').split('.')[0];
        const fileDate = new Date(dateStr.replace(/-/g, (match, offset) => {
          return offset < 16 ? (offset % 8 === 2 || offset % 8 === 5 ? '-' : 'T') : ':';
        }));
        
        return fileDate < cutoffDate;
      } catch (err) {
        console.warn(`Could not parse date from filename: ${file.name}`);
        return false;
      }
    });
    
    // Delete old backups
    for (const file of oldBackups) {
      const { error: deleteError } = await supabase
        .storage
        .from(storageBucket)
        .remove([file.name]);
      
      if (deleteError) {
        console.error(`Error deleting old backup ${file.name}:`, deleteError);
      } else {
        console.log(`Deleted old backup: ${file.name}`);
      }
    }
    
    console.log(`Retention management complete. Deleted ${oldBackups.length} old backups.`);
  } catch (err) {
    console.error('Error in backup retention management:', err);
  }
}


if (require.main === module) {
  runBackup()
    .then(result => {
      if (result.success) {
        console.log('Backup completed successfully');
        process.exit(0);
      } else {
        console.error('Backup failed:', result.error);
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Unhandled error in backup process:', err);
      process.exit(1);
    });
}


module.exports = { runBackup };