const CDP = require('chrome-remote-interface');

async function mainScript({Debugger}) {
    return new Promise((fulfill, reject) => {
        Debugger.scriptParsed((params) => {
            const {scriptId, url} = params;
            if (url.endsWith('/issue-179.html')) {
                fulfill(params);
            }
        });
    });
}

CDP(async (client) => {
    try {
        const {Debugger, Page} = client;
        // enable debugger domain
        await Debugger.enable();
        // immediately pause the debugger
        await Debugger.pause();
        // wait for the script
        const {scriptId} = await mainScript(client);
        // sets a breakpoint
        const {breakpointId} = await Debugger.setBreakpoint({
            location: {
                scriptId,
                lineNumber: 6 - 1 // (zero-based)
            }
        });
        // allow to reach the breakpoint
        Debugger.resume();
        // every time the debugger is paused print the current line then step over
        Debugger.paused(({callFrames}) => {
            console.log(`PAUSED at line ${callFrames[0].location.lineNumber + 1}`); // (zero-based)
            setTimeout(Debugger.stepOver, 1000);
        });
    } catch (err) {
        console.error(err);
    }
}).on('error', (err) => {
    console.error(err);
});
