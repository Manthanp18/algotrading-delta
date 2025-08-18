#!/usr/bin/env node

/**
 * IMPROVED SUPERTREND TESTING AND VALIDATION
 * 
 * Tests SuperTrend with better data initialization and validation
 */

const RenkoEngine = require('./legacy-src/engines/RenkoEngine');

console.log('🔧 IMPROVED SUPERTREND TESTING');
console.log('=' .repeat(50));

class ImprovedSuperTrendTester {
  constructor() {
    this.testResults = [];
  }

  // Generate more comprehensive test data for Renko
  generateRenkoTestData(count = 200, basePrice = 95000) {
    const data = [];
    let price = basePrice;
    
    for (let i = 0; i < count; i++) {
      const timestamp = new Date(Date.now() - (count - i) * 60000);
      timestamp.setSeconds(0, 0);
      
      // More realistic price movement with trends
      const trendComponent = Math.sin(i / 20) * 50; // Trend component
      const volatility = 30 + Math.random() * 70; // 30-100 point volatility
      const change = (Math.random() - 0.5) * volatility + trendComponent;
      
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * volatility * 0.4;
      const low = Math.min(open, close) - Math.random() * volatility * 0.4;
      const volume = 100000 + Math.random() * 500000;
      
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

  // Test SuperTrend with comprehensive data
  testSuperTrendWithData(dataCount, description) {
    console.log(`\n📊 Testing SuperTrend: ${description}`);
    console.log('-' .repeat(40));
    
    const renkoEngine = new RenkoEngine({
      priceSource: 'close',
      atrPeriod: 14,
      atrMultiplier: 0.5,
      autoCalculateBrickSize: true
    });
    
    const testData = this.generateRenkoTestData(dataCount);
    
    // Feed data to Renko engine
    testData.forEach(candle => {
      renkoEngine.updatePrice(candle);
    });
    
    const allBricks = renkoEngine.getAllBricks();
    console.log(`   Generated ${allBricks.length} Renko bricks from ${dataCount} candles`);
    
    // Test different SuperTrend configurations
    const configurations = [
      { period: 7, multiplier: 2.0 },
      { period: 7, multiplier: 3.0 },
      { period: 10, multiplier: 2.0 },
      { period: 10, multiplier: 3.0 },
      { period: 14, multiplier: 2.0 },
      { period: 14, multiplier: 3.0 }
    ];
    
    let successCount = 0;
    
    for (const config of configurations) {
      try {
        const superTrend = renkoEngine.calculateRenkoSuperTrend(config.period, config.multiplier);
        
        if (superTrend && superTrend.trend !== null && superTrend.value !== null && superTrend.direction !== null) {
          successCount++;
          console.log(`   ✅ SuperTrend(${config.period}, ${config.multiplier}): ${superTrend.direction} @ ${superTrend.value.toFixed(2)}`);
          console.log(`      ATR: ${superTrend.atr?.toFixed(2)}, Bands: ${superTrend.upperBand?.toFixed(2)}/${superTrend.lowerBand?.toFixed(2)}`);
        } else {
          console.log(`   ❌ SuperTrend(${config.period}, ${config.multiplier}): Failed - insufficient data`);
        }
      } catch (error) {
        console.log(`   ❌ SuperTrend(${config.period}, ${config.multiplier}): Error - ${error.message}`);
      }
    }
    
    const successRate = (successCount / configurations.length * 100).toFixed(1);
    console.log(`   Success Rate: ${successCount}/${configurations.length} (${successRate}%)`);
    
    return {
      description,
      dataCount,
      brickCount: allBricks.length,
      successCount,
      totalTests: configurations.length,
      successRate: parseFloat(successRate)
    };
  }

  // Test different data scenarios
  runComprehensiveTests() {
    console.log('🚀 Starting Comprehensive SuperTrend Testing...\n');
    
    const scenarios = [
      { count: 50, desc: '50 Candles (Minimal Data)' },
      { count: 100, desc: '100 Candles (Standard Test)' },
      { count: 200, desc: '200 Candles (Extended Data)' },
      { count: 500, desc: '500 Candles (Large Dataset)' }
    ];
    
    for (const scenario of scenarios) {
      const result = this.testSuperTrendWithData(scenario.count, scenario.desc);
      this.testResults.push(result);
    }
    
    this.printSummary();
  }

  // Print final summary
  printSummary() {
    console.log('\n' + '=' .repeat(50));
    console.log('📊 SUPERTREND TESTING SUMMARY');
    console.log('=' .repeat(50));
    
    let totalSuccess = 0;
    let totalTests = 0;
    
    for (const result of this.testResults) {
      totalSuccess += result.successCount;
      totalTests += result.totalTests;
      
      console.log(`${result.description}:`);
      console.log(`   Data: ${result.dataCount} candles → ${result.brickCount} bricks`);
      console.log(`   Success: ${result.successCount}/${result.totalTests} (${result.successRate}%)`);
      console.log('');
    }
    
    const overallSuccessRate = (totalSuccess / totalTests * 100).toFixed(1);
    console.log(`OVERALL: ${totalSuccess}/${totalTests} tests passed (${overallSuccessRate}%)`);
    
    console.log('\n💡 FINDINGS:');
    if (overallSuccessRate >= 80) {
      console.log('   ✅ SuperTrend is working well with sufficient data');
    } else {
      console.log('   ⚠️ SuperTrend needs more data for reliable calculations');
    }
    
    console.log('\n🔧 RECOMMENDATIONS:');
    console.log('   1. Use period 7 for fast SuperTrend signals');
    console.log('   2. Allow 100+ candles before using periods 10+');
    console.log('   3. Monitor brick generation rate in live trading');
    console.log('   4. Consider fallback to period 7 if higher periods fail');
    
    console.log('\n📈 FOR 1-MINUTE CHARTS:');
    console.log('   - Period 7: Use immediately (requires ~50 bricks)');
    console.log('   - Period 10: Wait 10-15 minutes for data');
    console.log('   - Period 14: Wait 15-20 minutes for reliable signals');
  }

  // Test 1-minute specific scenario
  test1MinuteScenario() {
    console.log('\n🕐 TESTING 1-MINUTE CHART SCENARIO');
    console.log('-' .repeat(40));
    
    // Simulate 30 minutes of 1-minute data
    const oneMinuteData = this.generateRenkoTestData(30, 95000);
    
    const renkoEngine = new RenkoEngine({
      priceSource: 'close',
      atrPeriod: 14,
      atrMultiplier: 0.3, // Lower for 1-minute charts
      autoCalculateBrickSize: true
    });
    
    // Feed data progressively (like live trading)
    for (let i = 0; i < oneMinuteData.length; i++) {
      renkoEngine.updatePrice(oneMinuteData[i]);
      
      const brickCount = renkoEngine.getAllBricks().length;
      
      // Test at key intervals
      if ([10, 15, 20, 25, 30].includes(i + 1)) {
        console.log(`\n   After ${i + 1} minutes (${brickCount} bricks):`);
        
        // Test period 7 (should work early)
        try {
          const st7 = renkoEngine.calculateRenkoSuperTrend(7, 3.0);
          if (st7 && st7.direction) {
            console.log(`     ✅ SuperTrend(7): ${st7.direction}`);
          } else {
            console.log(`     ❌ SuperTrend(7): Not ready`);
          }
        } catch (error) {
          console.log(`     ❌ SuperTrend(7): Error`);
        }
        
        // Test period 10
        try {
          const st10 = renkoEngine.calculateRenkoSuperTrend(10, 3.0);
          if (st10 && st10.direction) {
            console.log(`     ✅ SuperTrend(10): ${st10.direction}`);
          } else {
            console.log(`     ❌ SuperTrend(10): Not ready`);
          }
        } catch (error) {
          console.log(`     ❌ SuperTrend(10): Error`);
        }
      }
    }
  }
}

// Run the improved tests
const tester = new ImprovedSuperTrendTester();
tester.runComprehensiveTests();
tester.test1MinuteScenario();