const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)

// Prevent Metro from crawling outside the mobile directory
config.watchFolders = [__dirname]
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')]

module.exports = config
