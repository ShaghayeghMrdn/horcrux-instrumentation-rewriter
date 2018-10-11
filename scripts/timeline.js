const CDP = require('chrome-remote-interface');
const fs = require('fs');
var TRACE_CATEGORIES = ["-*", "devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "toplevel", "blink.console", "disabled-by-default-devtools.timeline.stack", "disabled-by-default-devtools.screenshot", "disabled-by-default-v8.cpu_profile", "disabled-by-default-v8.cpu_profiler", "disabled-by-default-v8.cpu_profiler.hires"];


CDP({port:7222},async (client) => {
    try {
        const {Page, Tracing} = client;
        // enable Page domain events
        await Page.enable();
        // trace a page load
        const events = [];
        Tracing.dataCollected(({value}) => {
            events.push(...value);
        });
        await Tracing.start({ "categories":   TRACE_CATEGORIES.join(',')});
        await Page.navigate({url: 'https://facebook.com'});
        await Page.loadEventFired();
        await Tracing.end();
        await Tracing.tracingComplete();
        // save the tracing data
        fs.writeFileSync('timeline.json', JSON.stringify(events));
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}).on('error', (err) => {
    console.error(err);
});
