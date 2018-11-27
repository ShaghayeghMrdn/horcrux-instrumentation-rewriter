var fs = require('fs');

var rawData = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));
var pData = {};

Object.defineProperty(Array.prototype, 'peekLast', {
  /**
   * @return {!T|undefined}
   * @this {Array.<!T>}
   * @template T
   */
  value: function() {
    return this[this.length - 1];
  }
});

for (var script in rawData) {
  // console.log(rawData[script]);
  var _pdata = getPCoverage(rawData, script)
  pData[rawData[script].url] = _pdata;

}

fs.writeFileSync(process.argv[3], JSON.stringify(pData, null, 2));

function _calculateCoverage(scriptCoverage) {
  if (!scriptCoverage) {
    console.log(`:coverage() > ${src} not found on the page.`);
    return new Error(`Couldn't locat script ${src} on the page.`);
  }

  if (scriptCoverage && scriptCoverage.functions && scriptCoverage.functions.length) {
    const coverageData = scriptCoverage.functions.reduce(
      (fnAccum, coverageStats) => {
        const functionStats = coverageStats.ranges.reduce(
          (rangeAccum, range) => {
            return {
              total: range.endOffset > rangeAccum.total ? range.endOffset : rangeAccum.total,
              unused:
                rangeAccum.unused + (range.count === 0 ? range.endOffset - range.startOffset : 0)
            };
          },
          {
            total: 0,
            unused: 0
          }
        );
        //console.log(functionStats)
        return {
          total: functionStats.total > fnAccum.total ? functionStats.total : fnAccum.total,
          unused: fnAccum.unused + functionStats.unused
        };
      },
      {
        total: 0,
        unused: 0
      }
    );

    return Object.assign(coverageData, {
      percentUnused: coverageData.unused / coverageData.total
    });
  }
  return Error('unexpected');
}

function calculateCoverage(res){
  var output = [];
  res.forEach((script) => {
    var temp = _calculateCoverage(script);
    output.push(temp);
  })
  return output;
}


function _convertToDisjointSegments(ranges) {
    ranges.sort((a, b) => a.startOffset - b.startOffset);

    const result = [];
    const stack = [];
    for (const entry of ranges) {
      let top = stack.peekLast();
      while (top && top.endOffset <= entry.startOffset) {
        append(top.endOffset, top.count);
        stack.pop();
        top = stack.peekLast();
      }
      append(entry.startOffset, top ? top.count : undefined);
      stack.push(entry);
    }

    while (stack.length) {
      const top = stack.pop();
      append(top.endOffset, top.count);
    }

    /**
     * @param {number} end
     * @param {number} count
     */
    function append(end, count) {
      const last = result.peekLast();
      if (last) {
        if (last.end === end)
          return;
        if (last.count === count) {
          last.end = end;
          return;
        }
      }
      result.push({end: end, count: count});
    }

    return result;
}


function getRanges(scriptId){
  var ranges = [];
    for (var f of scriptId.functions) {
      for (var range of f.ranges) {
        ranges.push(range);
      }
  }
  return ranges;
}


function getUsedSize(segments) {
  var usedSize = 0;
  let last = 0;
  for (var segment of segments) {
    if (segment.count)
      usedSize += segment.end - last;
    last = segment.end;
  }

  return usedSize;
}

function getPCoverage(rawData, scriptId){
  var semiResult = _calculateCoverage(rawData[scriptId])
  var ranges = getRanges(rawData[scriptId]);
  var segs = _convertToDisjointSegments(ranges);
  var usedsize = getUsedSize(segs);
  return [semiResult.total, usedsize]
}

