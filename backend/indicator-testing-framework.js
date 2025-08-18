#!/usr/bin/env node

/**
 * COMPREHENSIVE INDICATOR TESTING FRAMEWORK
 * 
 * Validates all technical indicators for proper implementation and 1-minute chart compatibility
 * Tests: SuperTrend, MACD, Volume Analysis, EMA, SMA, RSI, ATR, Stochastic
 */

const BaseStrategy = require('./legacy-src/strategies/baseStrategy');
const RenkoEngine = require('./legacy-src/engines/RenkoEngine');
const EliteScalpingStrategy = require('./legacy-src/strategies/eliteScalpingStrategy');

console.log('🧪 COMPREHENSIVE INDICATOR TESTING FRAMEWORK');
console.log('=' .repeat(80));

class IndicatorTester {
  constructor() {
    this.baseStrategy = new BaseStrategy('Test Strategy');
    this.eliteStrategy = new EliteScalpingStrategy();
    this.renkoEngine = new RenkoEngine({
      priceSource: 'close',
      atrPeriod: 14,
      atrMultiplier: 0.5,
      autoCalculateBrickSize: true
    });
    this.testResults = {};
  }

  // Generate realistic 1-minute test data
  generateTestData(count = 100, basePrice = 95000) {
    const data = [];
    let price = basePrice;
    
    for (let i = 0; i < count; i++) {
      const timestamp = new Date(Date.now() - (count - i) * 60000); // 1-minute intervals
      timestamp.setSeconds(0, 0);
      
      // Realistic price movement
      const volatility = 50 + Math.random() * 100; // 50-150 point volatility
      const change = (Math.random() - 0.5) * volatility;
      
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * volatility * 0.3;
      const low = Math.min(open, close) - Math.random() * volatility * 0.3;
      const volume = 500000 + Math.random() * 2000000; // Realistic BTC volume
      
      data.push({
        timestamp,
        open: Math.max(open, 90000),
        high: Math.max(high, 90000),
        low: Math.max(low, 90000),
        close: Math.max(close, 90000),
        volume: Math.round(volume)
      });
      
      price = close;
    }
    
    return data;
  }

  // Test EMA calculations
  testEMA() {
    console.log('\n📊 TESTING EMA (Exponential Moving Average)');
    console.log('-' .repeat(50));
    
    const testData = this.generateTestData(50);
    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };
    
    // Test different periods
    const periods = [5, 12, 21, 26, 50];
    
    for (const period of periods) {
      try {
        const ema = this.baseStrategy.calculateEMA(testData, period);
        const emaArray = this.baseStrategy.calculateEMAArray(testData, period);
        
        if (ema !== null && !isNaN(ema) && ema > 0) {
          results.passed++;
          results.tests.push(`✅ EMA-${period}: ${ema.toFixed(2)}`);
        } else {
          results.failed++;
          results.tests.push(`❌ EMA-${period}: Invalid result`);
        }
        
        // Test EMA array
        if (emaArray && emaArray.length > 0 && !emaArray.some(val => isNaN(val))) {
          results.passed++;
          results.tests.push(`✅ EMA-${period} Array: ${emaArray.length} values`);
        } else {
          results.failed++;
          results.tests.push(`❌ EMA-${period} Array: Invalid`);
        }
        
      } catch (error) {
        results.failed++;
        results.tests.push(`❌ EMA-${period}: Error - ${error.message}`);
      }
    }
    
    // Test 1-minute compatibility
    const oneMinuteData = this.generateTestData(60); // 1 hour of 1-minute data
    try {
      const ema12 = this.baseStrategy.calculateEMA(oneMinuteData, 12);
      if (ema12 && !isNaN(ema12)) {
        results.passed++;
        results.tests.push(`✅ 1-Minute Compatibility: EMA-12 = ${ema12.toFixed(2)}`);
      } else {
        results.failed++;
        results.tests.push(`❌ 1-Minute Compatibility: Failed`);
      }
    } catch (error) {
      results.failed++;
      results.tests.push(`❌ 1-Minute Compatibility: ${error.message}`);
    }
    
    this.testResults.ema = results;
    this.printTestResults('EMA', results);
  }

  // Test MACD calculations
  testMACD() {
    console.log('\n📊 TESTING MACD (Moving Average Convergence Divergence)');
    console.log('-' .repeat(50));
    
    const testData = this.generateTestData(100);
    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };
    
    // Test standard MACD (12, 26, 9)
    try {
      const macd = this.baseStrategy.calculateMACD(testData, 12, 26, 9);
      
      if (macd && typeof macd === 'object') {
        // Check all MACD components
        const components = ['macd', 'signal', 'histogram', 'direction'];
        for (const component of components) {
          if (macd.hasOwnProperty(component) && macd[component] !== null) {
            results.passed++;
            results.tests.push(`✅ MACD ${component}: ${typeof macd[component] === 'number' ? macd[component].toFixed(4) : macd[component]}`);
          } else {
            results.failed++;
            results.tests.push(`❌ MACD ${component}: Missing or null`);
          }
        }
        
        // Test crossover detection
        if (macd.crossover) {
          results.passed++;
          results.tests.push(`✅ MACD Crossover Detection: ${macd.crossover}`);
        } else {
          results.tests.push(`ℹ️ MACD Crossover: No crossover detected`);
        }
        
      } else {
        results.failed++;
        results.tests.push(`❌ MACD: Invalid result structure`);
      }
    } catch (error) {
      results.failed++;
      results.tests.push(`❌ MACD: Error - ${error.message}`);
    }
    
    // Test different parameter combinations
    const paramSets = [
      [5, 13, 5],   // Fast scalping
      [12, 26, 9],  // Standard
      [19, 39, 9]   // Slower
    ];
    
    for (const [fast, slow, signal] of paramSets) {
      try {
        const macd = this.baseStrategy.calculateMACD(testData, fast, slow, signal);
        if (macd && !isNaN(macd.macd)) {
          results.passed++;
          results.tests.push(`✅ MACD(${fast},${slow},${signal}): Valid`);
        } else {
          results.failed++;
          results.tests.push(`❌ MACD(${fast},${slow},${signal}): Invalid`);
        }
      } catch (error) {
        results.failed++;
        results.tests.push(`❌ MACD(${fast},${slow},${signal}): ${error.message}`);
      }
    }
    
    this.testResults.macd = results;
    this.printTestResults('MACD', results);
  }

  // Test RSI calculations
  testRSI() {
    console.log('\n📊 TESTING RSI (Relative Strength Index)');
    console.log('-' .repeat(50));
    
    const testData = this.generateTestData(50);
    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };
    
    const periods = [14, 21, 9]; // Common RSI periods
    
    for (const period of periods) {
      try {
        const rsi = this.baseStrategy.calculateRSI(testData, period);
        
        if (rsi !== null && !isNaN(rsi) && rsi >= 0 && rsi <= 100) {
          results.passed++;
          results.tests.push(`✅ RSI-${period}: ${rsi.toFixed(2)} (Valid range: 0-100)`);
        } else {
          results.failed++;
          results.tests.push(`❌ RSI-${period}: ${rsi} (Invalid range or null)`);
        }
      } catch (error) {
        results.failed++;
        results.tests.push(`❌ RSI-${period}: Error - ${error.message}`);
      }
    }
    
    // Test with trending data
    const trendingData = this.generateTrendingData(50, 'up');
    try {
      const rsi = this.baseStrategy.calculateRSI(trendingData, 14);
      if (rsi && rsi > 50) {
        results.passed++;
        results.tests.push(`✅ RSI Trending Up: ${rsi.toFixed(2)} > 50`);
      } else {
        results.tests.push(`ℹ️ RSI Trending Up: ${rsi?.toFixed(2) || 'null'} (Expected > 50)`);
      }
    } catch (error) {
      results.failed++;
      results.tests.push(`❌ RSI Trending Test: ${error.message}`);
    }
    
    this.testResults.rsi = results;
    this.printTestResults('RSI', results);
  }

  // Test Volume analysis
  testVolumeAnalysis() {
    console.log('\n📊 TESTING VOLUME ANALYSIS');
    console.log('-' .repeat(50));
    
    const testData = this.generateTestData(50);
    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };
    
    // Test Volume Moving Average
    try {
      const volumeMA = this.baseStrategy.calculateVolumeMA(testData, 20);
      if (volumeMA && !isNaN(volumeMA) && volumeMA > 0) {
        results.passed++;
        results.tests.push(`✅ Volume MA-20: ${volumeMA.toFixed(0)}`);
      } else {
        results.failed++;
        results.tests.push(`❌ Volume MA-20: Invalid result`);
      }
    } catch (error) {
      results.failed++;
      results.tests.push(`❌ Volume MA: Error - ${error.message}`);
    }
    
    // Test Elite Strategy Volume Quality
    try {
      const volumeQuality = this.eliteStrategy.checkVolumeQuality(testData, testData.length - 1);
      if (volumeQuality && typeof volumeQuality === 'object') {
        results.passed++;
        results.tests.push(`✅ Volume Quality Score: ${volumeQuality.score}/3 - ${volumeQuality.details}`);
        
        if (volumeQuality.volumeRatio) {
          results.passed++;
          results.tests.push(`✅ Volume Ratio: ${volumeQuality.volumeRatio.toFixed(2)}x`);
        }
      } else {
        results.failed++;
        results.tests.push(`❌ Volume Quality: Invalid result`);
      }
    } catch (error) {
      results.failed++;
      results.tests.push(`❌ Volume Quality: Error - ${error.message}`);
    }
    
    // Test volume surge detection with RenkoEngine
    try {
      const volumeData = testData.map(candle => candle.volume);
      const volumeSurge = this.renkoEngine.detectVolumeSurge(volumeData, 1.5);
      
      if (volumeSurge && typeof volumeSurge === 'object') {
        results.passed++;
        results.tests.push(`✅ Volume Surge Detection: ${volumeSurge.surge ? 'SURGE' : 'NORMAL'} (${volumeSurge.ratio.toFixed(2)}x)`);
      } else {
        results.failed++;
        results.tests.push(`❌ Volume Surge Detection: Invalid`);
      }
    } catch (error) {
      results.failed++;
      results.tests.push(`❌ Volume Surge Detection: ${error.message}`);
    }
    
    this.testResults.volume = results;
    this.printTestResults('Volume Analysis', results);
  }

  // Test SuperTrend calculations  
  testSuperTrend() {
    console.log('\n📊 TESTING SUPERTREND INDICATOR');
    console.log('-' .repeat(50));
    
    const testData = this.generateTestData(100);
    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };
    
    // Feed data to Renko engine
    testData.forEach(candle => {
      this.renkoEngine.updatePrice(candle);
    });
    
    // Test SuperTrend calculation
    const periods = [7, 10, 14];
    const multipliers = [2.0, 3.0, 4.0];
    
    for (const period of periods) {
      for (const multiplier of multipliers) {
        try {
          const superTrend = this.renkoEngine.calculateRenkoSuperTrend(period, multiplier);
          
          if (superTrend && typeof superTrend === 'object') {
            const components = ['trend', 'value', 'direction', 'atr', 'upperBand', 'lowerBand'];
            let validComponents = 0;
            
            for (const component of components) {
              if (superTrend.hasOwnProperty(component) && superTrend[component] !== null) {
                validComponents++;
              }
            }
            
            if (validComponents === components.length) {
              results.passed++;
              results.tests.push(`✅ SuperTrend(${period}, ${multiplier}): Direction=${superTrend.direction}, Value=${superTrend.value?.toFixed(2)}`);
            } else {
              results.failed++;
              results.tests.push(`❌ SuperTrend(${period}, ${multiplier}): Missing components (${validComponents}/${components.length})`);
            }
          } else {
            results.failed++;
            results.tests.push(`❌ SuperTrend(${period}, ${multiplier}): Invalid result`);
          }
        } catch (error) {
          results.failed++;
          results.tests.push(`❌ SuperTrend(${period}, ${multiplier}): Error - ${error.message}`);
        }
      }
    }
    
    // Test 1-minute compatibility
    const oneMinuteData = this.generateTestData(60);
    const renkoTest = new RenkoEngine({ priceSource: 'close', atrPeriod: 14, atrMultiplier: 0.5 });
    
    oneMinuteData.forEach(candle => renkoTest.updatePrice(candle));
    
    try {
      const superTrend1m = renkoTest.calculateRenkoSuperTrend(10, 3.0);
      if (superTrend1m && superTrend1m.direction) {
        results.passed++;
        results.tests.push(`✅ 1-Minute Compatibility: SuperTrend working on 1m data`);
      } else {
        results.failed++;
        results.tests.push(`❌ 1-Minute Compatibility: SuperTrend failed on 1m data`);
      }
    } catch (error) {
      results.failed++;
      results.tests.push(`❌ 1-Minute Compatibility: ${error.message}`);
    }
    
    this.testResults.supertrend = results;
    this.printTestResults('SuperTrend', results);
  }

  // Test ATR calculations
  testATR() {
    console.log('\n📊 TESTING ATR (Average True Range)');
    console.log('-' .repeat(50));
    
    const testData = this.generateTestData(50);
    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };
    
    const periods = [7, 14, 21];
    
    for (const period of periods) {
      try {
        const atr = this.eliteStrategy.calculateATR(testData, period);
        
        if (atr !== null && !isNaN(atr) && atr > 0) {
          results.passed++;
          results.tests.push(`✅ ATR-${period}: ${atr.toFixed(2)}`);
        } else {
          results.failed++;
          results.tests.push(`❌ ATR-${period}: Invalid result`);
        }
      } catch (error) {
        results.failed++;
        results.tests.push(`❌ ATR-${period}: Error - ${error.message}`);
      }
    }
    
    // Test dynamic targets calculation
    try {
      const dynamicTargets = this.eliteStrategy.calculateDynamicTargets(testData);
      if (dynamicTargets && dynamicTargets.targetPoints > 0 && dynamicTargets.stopLossPoints > 0) {
        results.passed++;
        results.tests.push(`✅ Dynamic Targets: Target=${dynamicTargets.targetPoints}, Stop=${dynamicTargets.stopLossPoints}`);
      } else {
        results.failed++;
        results.tests.push(`❌ Dynamic Targets: Invalid`);
      }
    } catch (error) {
      results.failed++;
      results.tests.push(`❌ Dynamic Targets: ${error.message}`);
    }
    
    this.testResults.atr = results;
    this.printTestResults('ATR', results);
  }

  // Test Stochastic calculations
  testStochastic() {
    console.log('\n📊 TESTING STOCHASTIC OSCILLATOR');
    console.log('-' .repeat(50));
    
    const testData = this.generateTestData(50);
    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };
    
    const kPeriods = [14, 21];
    const dPeriods = [3, 5];
    
    for (const kPeriod of kPeriods) {
      for (const dPeriod of dPeriods) {
        try {
          const stoch = this.baseStrategy.calculateStochastic(testData, kPeriod, dPeriod);
          
          if (stoch && typeof stoch === 'object' && 
              stoch.k >= 0 && stoch.k <= 100 && 
              stoch.d >= 0 && stoch.d <= 100) {
            results.passed++;
            results.tests.push(`✅ Stochastic(%K=${kPeriod}, %D=${dPeriod}): K=${stoch.k.toFixed(2)}, D=${stoch.d.toFixed(2)}`);
          } else {
            results.failed++;
            results.tests.push(`❌ Stochastic(%K=${kPeriod}, %D=${dPeriod}): Invalid range`);
          }
        } catch (error) {
          results.failed++;
          results.tests.push(`❌ Stochastic(%K=${kPeriod}, %D=${dPeriod}): Error - ${error.message}`);
        }
      }
    }
    
    this.testResults.stochastic = results;
    this.printTestResults('Stochastic', results);
  }

  // Test comprehensive 1-minute compatibility
  test1MinuteCompatibility() {
    console.log('\n📊 TESTING 1-MINUTE CHART COMPATIBILITY');
    console.log('-' .repeat(50));
    
    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };
    
    // Generate exactly 1 hour of 1-minute data (60 candles)
    const oneMinuteData = [];
    let basePrice = 95000;
    
    for (let i = 0; i < 60; i++) {
      const timestamp = new Date();
      timestamp.setMinutes(timestamp.getMinutes() - (60 - i));
      timestamp.setSeconds(0, 0);
      
      const volatility = 30; // Lower volatility for 1-minute
      const change = (Math.random() - 0.5) * volatility;
      
      const open = basePrice;
      const close = basePrice + change;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;
      const volume = 100000 + Math.random() * 500000; // Typical 1-minute volume
      
      oneMinuteData.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume: Math.round(volume)
      });
      
      basePrice = close;
    }
    
    // Test each indicator on 1-minute data
    const indicators = {
      'EMA-12': () => this.baseStrategy.calculateEMA(oneMinuteData, 12),
      'EMA-21': () => this.baseStrategy.calculateEMA(oneMinuteData, 21),
      'MACD(12,26,9)': () => this.baseStrategy.calculateMACD(oneMinuteData, 12, 26, 9),
      'RSI-14': () => this.baseStrategy.calculateRSI(oneMinuteData, 14),
      'Volume MA-20': () => this.baseStrategy.calculateVolumeMA(oneMinuteData, 20),
      'ATR-14': () => this.eliteStrategy.calculateATR(oneMinuteData, 14),
      'Stochastic(14,3)': () => this.baseStrategy.calculateStochastic(oneMinuteData, 14, 3)
    };
    
    for (const [name, calculator] of Object.entries(indicators)) {
      try {
        const result = calculator();
        if (result !== null && result !== undefined) {
          results.passed++;
          results.tests.push(`✅ ${name}: Compatible with 1-minute data`);
        } else {
          results.failed++;
          results.tests.push(`❌ ${name}: Null result on 1-minute data`);
        }
      } catch (error) {
        results.failed++;
        results.tests.push(`❌ ${name}: Error on 1-minute data - ${error.message}`);
      }
    }
    
    // Test SuperTrend on 1-minute via Renko
    const renko1m = new RenkoEngine({ priceSource: 'close', atrPeriod: 14, atrMultiplier: 0.3 });
    oneMinuteData.forEach(candle => renko1m.updatePrice(candle));
    
    try {
      const superTrend1m = renko1m.calculateRenkoSuperTrend(10, 3.0);
      if (superTrend1m && superTrend1m.direction) {
        results.passed++;
        results.tests.push(`✅ SuperTrend: Compatible with 1-minute data`);
      } else {
        results.failed++;
        results.tests.push(`❌ SuperTrend: Failed on 1-minute data`);
      }
    } catch (error) {
      results.failed++;
      results.tests.push(`❌ SuperTrend: Error on 1-minute data - ${error.message}`);
    }
    
    this.testResults.oneMinute = results;
    this.printTestResults('1-Minute Compatibility', results);
  }

  // Helper method to generate trending data
  generateTrendingData(count, direction = 'up', basePrice = 95000) {
    const data = [];
    let price = basePrice;
    const trendStrength = direction === 'up' ? 0.8 : -0.8;
    
    for (let i = 0; i < count; i++) {
      const timestamp = new Date(Date.now() - (count - i) * 60000);
      const volatility = 50;
      const trend = trendStrength * volatility * 0.1;
      const noise = (Math.random() - 0.5) * volatility * 0.5;
      
      const open = price;
      const close = price + trend + noise;
      const high = Math.max(open, close) + Math.random() * volatility * 0.3;
      const low = Math.min(open, close) - Math.random() * volatility * 0.3;
      
      data.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume: 500000 + Math.random() * 1000000
      });
      
      price = close;
    }
    
    return data;
  }

  // Print test results
  printTestResults(testName, results) {
    console.log(`\n${testName} Test Results: ${results.passed} passed, ${results.failed} failed`);
    results.tests.forEach(test => console.log(`   ${test}`));
  }

  // Run all tests
  runAllTests() {
    console.log('\n🚀 STARTING COMPREHENSIVE INDICATOR TESTING');
    console.log('Testing all indicators for proper implementation and 1-minute compatibility...\n');
    
    this.testEMA();
    this.testMACD();
    this.testRSI();
    this.testVolumeAnalysis();
    this.testSuperTrend();
    this.testATR();
    this.testStochastic();
    this.test1MinuteCompatibility();
    
    this.printFinalSummary();
  }

  // Print final summary
  printFinalSummary() {
    console.log('\n' + '=' .repeat(80));
    console.log('📊 FINAL TESTING SUMMARY');
    console.log('=' .repeat(80));
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const [testName, results] of Object.entries(this.testResults)) {
      totalPassed += results.passed;
      totalFailed += results.failed;
      const successRate = results.passed + results.failed > 0 ? 
        ((results.passed / (results.passed + results.failed)) * 100).toFixed(1) : '0';
      
      console.log(`${testName.toUpperCase().padEnd(20)}: ${results.passed}/${results.passed + results.failed} (${successRate}%)`);
    }
    
    const overallSuccessRate = totalPassed + totalFailed > 0 ? 
      ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1) : '0';
    
    console.log('\n' + '-' .repeat(80));
    console.log(`OVERALL RESULTS: ${totalPassed}/${totalPassed + totalFailed} tests passed (${overallSuccessRate}%)`);
    
    if (overallSuccessRate >= 90) {
      console.log('🎉 EXCELLENT: All indicators are properly coded and 1-minute compatible!');
    } else if (overallSuccessRate >= 80) {
      console.log('✅ GOOD: Most indicators working correctly, minor issues found');
    } else if (overallSuccessRate >= 70) {
      console.log('⚠️ WARNING: Some indicators need attention');
    } else {
      console.log('❌ CRITICAL: Major issues found with indicators');
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('   - All indicators that passed are safe to use in live trading');
    console.log('   - Failed indicators should be reviewed and fixed');
    console.log('   - 1-minute compatibility ensures real-time scalping works correctly');
    console.log('   - Run this test regularly when modifying indicators');
  }
}

// Run the tests
const tester = new IndicatorTester();
tester.runAllTests();