const { schedule } = require('@netlify/functions');
const { runBackup } = require('../../supabase-storage-backup');

// Run daily at 2 AM
const handler = async (event) => {
  console.log('Scheduled backup triggered');
  
  try {
    const result = await runBackup();
    
    if (result.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Backup completed successfully', filename: result.filename })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Backup failed', error: result.error })
      };
    }
  } catch (error) {
    console.error('Error in scheduled backup:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Unhandled error in backup process', error: error.message })
    };
  }
};


exports.handler = schedule('0 2 * * *', handler);