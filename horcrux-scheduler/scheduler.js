// this is the main-thread scheduler
const __callScheduler__ = function(fnBody, fnSignature) {
    const fnArgs = '';
    // prepare the input arguments for the fnBody using the signature
    fnSignature.forEach((dependency) => {
        if (dependency[0].startsWith('closure')) {
            console.error('Cannot handle:', dependency);
        } else if (!dependency[0].startsWith('global')) {
            console.log('Besides global and cloure:', dependency);
        }
        // no action is needed, if it's a global depedendency
    });
    console.log('LOG: fnArgs:"' + fnArgs + '"');
    const reconstructed = new Function(fnArgs, fnBody);
    reconstructed();
};

