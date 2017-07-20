
({
  optimize: 'none',
  onModuleBundleComplete: function (data) {
    console.log('hii')
    var fs = module.require('fs'),
        amdclean = module.require('amdclean'),
        outputFile = data.path,
        cleanedCode = amdclean.clean({
          'filePath': outputFile
        });

    fs.writeFileSync(outputFile, cleanedCode);
  },

  out: 'buildi.js',
  name: 'main'
})
