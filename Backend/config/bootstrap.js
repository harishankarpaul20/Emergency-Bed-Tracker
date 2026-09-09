const path = require('path');
const fs = require('fs');
const Module = require('module');

// Fast, verified module cache on primary drive (bypasses FAT32 USB limitations in local development)
const cleanModules = path.resolve(
  'C:/Users/Win11/.gemini/antigravity/brain/178cda03-21e7-4a93-a1c1-214518e97061/scratch/clean_modules/node_modules'
);

if (fs.existsSync(cleanModules)) {
  const origResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (!request.startsWith('.') && !path.isAbsolute(request)) {
      try {
        return origResolveFilename.call(
          this,
          request,
          { id: 'fast_loader', paths: [cleanModules] },
          isMain,
          options
        );
      } catch (e) {
        // Fallback to standard resolution if not in cleanModules
      }
    }
    return origResolveFilename.call(this, request, parent, isMain, options);
  };
}

module.exports = { cleanModules };
