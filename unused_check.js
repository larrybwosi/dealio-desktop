const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src');

function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            getAllFiles(filePath, fileList);
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css')) {
                 // Skip main entry points and d.ts
                if (file !== 'main.tsx' && file !== 'vite-env.d.ts' && file !== 'App.tsx' && file !== 'index.css') {
                    fileList.push(filePath);
                }
            }
        }
    });
    return fileList;
}

const allFiles = getAllFiles(srcDir);
const fileContents = {};

// Read all files once
allFiles.forEach(file => {
    fileContents[file] = fs.readFileSync(file, 'utf8');
});

const unusedFiles = [];

allFiles.forEach(targetFile => {
    const targetBasename = path.basename(targetFile, path.extname(targetFile));
    // also check for index files which are imported by their directory name
    const targetDirname = path.basename(path.dirname(targetFile));
    const isIndex = targetBasename === 'index';
    
    let isUsed = false;
    
    for (const [sourceFile, content] of Object.entries(fileContents)) {
        if (sourceFile === targetFile) continue;
        
        // Simple heuristic: check if the basename is present in the content
        // usage: import ... from './basename' or './path/to/basename'
        // For index files, check for import ... from './dirname'
        
        if (content.includes(targetBasename)) {
             isUsed = true;
             break;
        }
        
        if (isIndex && content.includes(targetDirname)) {
            isUsed = true;
            break;
        }

        // Check relative path references vaguely
        // This is a naive check but helpful for a first pass
    }
    
    if (!isUsed) {
        unusedFiles.push(targetFile);
    }
});

console.log('Potentially Unused Files:');
unusedFiles.forEach(f => console.log(path.relative(srcDir, f)));
