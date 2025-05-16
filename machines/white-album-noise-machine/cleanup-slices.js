const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const SLICES_DIR = './slices';
const THRESHOLD_DB = -30; // Adjust this threshold as needed (-30dB is quite quiet)

async function getAudioStats(filePath) {
    try {
        // Use ffmpeg to analyze the audio file
        const { stdout } = await execPromise(`ffmpeg -i "${filePath}" -af "volumedetect" -f null - 2>&1`);
        
        // Extract mean volume
        const meanVolumeMatch = stdout.match(/mean_volume: ([-0-9.]+)/);
        
        if (!meanVolumeMatch) {
            console.error(`Could not analyze ${filePath}`);
            return null;
        }

        const meanVolume = parseFloat(meanVolumeMatch[1]);

        return {
            filePath,
            meanVolume
        };
    } catch (error) {
        console.error(`Error analyzing ${filePath}:`, error.message);
        return null;
    }
}

async function cleanupSlices() {
    try {
        // Get all wav files
        const files = fs.readdirSync(SLICES_DIR)
            .filter(file => file.endsWith('.wav'))
            .map(file => path.join(SLICES_DIR, file));

        console.log(`Analyzing ${files.length} audio files...`);
        
        // Analyze all files
        const stats = [];
        for (const file of files) {
            const stat = await getAudioStats(file);
            if (stat) {
                stats.push(stat);
            }
        }

        // Sort by volume (quietest first)
        stats.sort((a, b) => a.meanVolume - b.meanVolume);

        // Find files to delete (only based on volume)
        const toDelete = stats.filter(stat => stat.meanVolume < THRESHOLD_DB);

        console.log('\nFiles to be deleted (sorted by volume, quietest first):');
        console.log('---------------------------------------------------');
        toDelete.forEach(stat => {
            console.log(`${path.basename(stat.filePath)}: ${stat.meanVolume.toFixed(2)}dB`);
        });

        // Print volume distribution
        console.log('\nVolume distribution:');
        console.log('-------------------');
        const volumeRanges = {
            'Above -12dB': 0,
            '-12dB to -18dB': 0,
            '-18dB to -24dB': 0,
            '-24dB to -30dB': 0,
            'Below -30dB': 0
        };

        stats.forEach(stat => {
            if (stat.meanVolume > -12) volumeRanges['Above -12dB']++;
            else if (stat.meanVolume > -18) volumeRanges['-12dB to -18dB']++;
            else if (stat.meanVolume > -24) volumeRanges['-18dB to -24dB']++;
            else if (stat.meanVolume > -30) volumeRanges['-24dB to -30dB']++;
            else volumeRanges['Below -30dB']++;
        });

        Object.entries(volumeRanges).forEach(([range, count]) => {
            console.log(`${range}: ${count} files (${((count/stats.length)*100).toFixed(1)}%)`);
        });

        // Ask for confirmation
        console.log(`\nFound ${toDelete.length} files below ${THRESHOLD_DB}dB out of ${files.length} total files.`);
        console.log('Press Ctrl+C to cancel or any other key to proceed with deletion...');
        
        // Wait for user input
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', async () => {
            process.stdin.setRawMode(false);
            
            // Delete files
            console.log('\nDeleting files...');
            for (const stat of toDelete) {
                try {
                    fs.unlinkSync(stat.filePath);
                    console.log(`Deleted: ${path.basename(stat.filePath)}`);
                } catch (error) {
                    console.error(`Error deleting ${stat.filePath}:`, error.message);
                }
            }
            
            console.log('\nCleanup complete!');
            process.exit(0);
        });

    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
}

// Run the cleanup
cleanupSlices(); 