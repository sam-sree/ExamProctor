module.exports = {
  appId: 'com.examproctor.app',
  productName: 'Exam Proctor',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: [
    'dist/**/*',
    'electron/**/*',
    'package.json'
  ],
  extraResources: [
    {
      from: 'dist-python',
      to: 'python-sidecar',
      filter: ['**/*']
    }
  ],
  win: {
    target: ['nsis', 'portable'],
    icon: 'build/icon.ico',
    // sign: '...' // Add code signing here in production
  },
  nsis: {
    oneClick: false,
    perMachine: true,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
  },
  mac: {
    target: ['dmg'],
    icon: 'build/icon.icns',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist'
    // identity: '...' // Add developer identity here
  },
  linux: {
    target: ['AppImage'],
    icon: 'build/icon.png'
  },
  publish: {
    provider: 'generic',
    url: 'https://api.yourdomain.com/updates' // Setup for auto-updater
  }
};
