function __defineScheduler__(window) {
    // List of available workers
    this.availableWorker = [];

    /* Wake up the main scheduler to handle:
      case 1: TODO
      case 2: when a function wanted to be invoked inside <script>
      -- This function is defined as a property of window so that
      it can be called from inside rewritten IIFE and async functions.
     */
    window.__callScheduler__ = function(fnBody, fnSignature) {
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
};

if (typeof __scheduler__ === 'undefined') {
    __scheduler__ = new __defineScheduler__(window);
}

