require('module-alias/register');
const dom_compare = require("@dom-compare");
const compare = dom_compare.compare;
const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const jsdiff = require("diff");
const pixelmatch = require("pixelmatch");
const PNG = require('pngjs').PNG;

const argv = require('minimist')(process.argv.slice(2), opts = {
    boolean: [
        "strip",
        "verbose",
        "simple"
    ],
    default: {
        "strip" : 0, 
        "simple" : 0,
        "verbose": 0, 
        "input": "output/output"
    }
});

function get_dom_from_file(filename, strip=false) {
    let text = fs.readFileSync(filename, 'utf8');
    if (strip) {
        text.replace('/<script([\S\s]*?)>([\S\s]*?)<\/script>/ig', '');
    }
    const dom = new JSDOM(text);
    const { document } = dom.window;
    return document;
}

function compare_dom(input, verbose, strip, simple) {
    let dom_0 = get_dom_from_file(input + "_dom" + "_0.txt", strip);
    let dom_1 = get_dom_from_file(input + "_dom" + "_1.txt", strip);
    let comp = compare(dom_0, dom_1, simple);
    if (verbose) {
        console.log(comp.getDifferences());
    }
    if (comp.getTotalNodes() < 10) {
        // Could not load page, exit early.
        return false;
    }
    console.log("nodes %d dom_differences %d", 
        comp.getTotalNodes(), 
        comp.getDiffNodes(), 
    );
    return true;
}

function compare_requests(input) {
    let net_0 = fs.readFileSync(input + "_network" + "_0.txt", 'utf8').split("\n").sort(); 
    let net_1 = fs.readFileSync(input + "_network" + "_1.txt", 'utf8').split("\n").sort(); 
    if (net_0.length < net_1.length) { // swap so net_0 is larger
        let temp = net_0;
        net_0 = net_1;
        net_1 = temp;
    }
    let total_reqs = net_1.length;
    let changes = jsdiff.diffLines(net_0.join("\n"), net_1.join("\n")); 
    let diffs = 0;
    for (let i = 0; i < changes.length; i++) {
        if (changes[i].removed) {
            diffs++;
        }
    }
    console.log("requests %d network_differences %d", 
        total_reqs, 
        diffs
    );
}


function compare_screenshots(input) {
    let pic_data_0 = fs.readFileSync(input + "_screenshot" + "_0.png"); 
    let pic_data_1 = fs.readFileSync(input + "_screenshot" + "_1.png");
    let pic_0 = new PNG.sync.read(pic_data_0);
    let pic_1 = new PNG.sync.read(pic_data_1);
    let num_pixels_diff = pixelmatch(pic_0.data, pic_1.data, null, pic_0.width, pic_0.height);
    let total_pixels = pic_0.width * pic_0.height; 
    console.log("pixels %d screenshot_differences %d", 
        total_pixels,
        num_pixels_diff
    );
}

(function main() {
    let strip = argv['strip'];
    let verbose = argv['verbose'];
    let input = argv['input'];
    let simple = argv['simple'];
    console.log(input.split('/').pop()); // log name of input
    if (compare_dom(input, verbose, strip, simple)) {
        // compare_requests(input);
        // compare_screenshots(input);
    }
})();
