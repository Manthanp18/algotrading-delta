#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Railway Deployment Verification');
console.log('================================');

const checks = [
  {
    name: 'Dockerfile exists',
    check: () => fs.existsSync('Dockerfile'),
    fix: 'Dockerfile is missing - it should have been created'
  },
  {
    name: 'railway.json exists',
    check: () => fs.existsSync('railway.json'),
    fix: 'railway.json is missing - it should have been created'
  },
  {
    name: '.dockerignore exists',
    check: () => fs.existsSync('.dockerignore'),
    fix: '.dockerignore is missing - it should have been created'
  },
  {
    name: 'server-live.js exists',
    check: () => fs.existsSync('server-live.js'),
    fix: 'server-live.js is missing - main application file'
  },
  {
    name: 'dashboard directory exists',
    check: () => fs.existsSync('dashboard') && fs.statSync('dashboard').isDirectory(),
    fix: 'dashboard directory is missing'
  },
  {
    name: 'dashboard/index.html exists',
    check: () => fs.existsSync('dashboard/index.html'),
    fix: 'dashboard/index.html is missing'
  },
  {
    name: 'dashboard/server.js exists',
    check: () => fs.existsSync('dashboard/server.js'),
    fix: 'dashboard/server.js is missing'
  },
  {
    name: 'package.json has start script',
    check: () => {
      try {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        return pkg.scripts && pkg.scripts.start;
      } catch (e) {
        return false;
      }
    },
    fix: 'package.json missing start script'
  },
  {
    name: 'Required dependencies installed',
    check: () => {
      try {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const deps = pkg.dependencies || {};
        return deps.express && deps.axios && deps['fs-extra'];
      } catch (e) {
        return false;
      }
    },
    fix: 'Missing required dependencies: express, axios, fs-extra'
  },
  {
    name: '.env file exists (for local development)',
    check: () => fs.existsSync('.env'),
    fix: '.env file exists (good for local testing)'
  }
];

let allPassed = true;

checks.forEach((check, index) => {
  const passed = check.check();
  const status = passed ? '✅' : '❌';
  console.log(`${index + 1}. ${status} ${check.name}`);
  
  if (!passed) {
    console.log(`   💡 ${check.fix}`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(40));

if (allPassed) {
  console.log('🎉 All checks passed! Your project is ready for Railway deployment.');
  console.log('\n📋 Next steps:');
  console.log('1. Run: ./deploy-setup.sh');
  console.log('2. Create GitHub repository');
  console.log('3. Push to GitHub');
  console.log('4. Deploy on Railway');
  console.log('5. Add environment variables in Railway dashboard');
  console.log('\n🌐 After deployment, your dashboard will be available at:');
  console.log('   https://your-app-name.up.railway.app');
} else {
  console.log('❌ Some checks failed. Please fix the issues above before deploying.');
}

console.log('\n📚 Full deployment guide: RAILWAY_DEPLOYMENT.md');

// Check environment variables
console.log('\n🔐 Environment Variables Check:');
const envVars = ['DELTA_API_KEY', 'DELTA_API_SECRET', 'DELTA_BASE_URL'];
envVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '⚠️ ';
  console.log(`   ${status} ${varName}: ${value ? 'Set' : 'Not set (will need to add in Railway)'}`);
});

console.log('\n💡 Remember to add all environment variables in Railway dashboard!');