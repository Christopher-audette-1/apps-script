// BetterLog (c) 2018 Peter Herrmann, MIT License

const BetterLog = (() => { // eslint-disable-line no-unused-vars
  const self = {};
  let cloudLogger = null;

  self.getCloudLogger = () => {
    if (cloudLogger) return cloudLogger;

    const log = (...args) => {
      // eslint-disable-next-line no-console
      console.log(...args);
    };

    cloudLogger = {
      log: log,
      info: log,
      warning: (...args) => {
        // eslint-disable-next-line no-console
        console.warn(...args);
      },
      error: (...args) => {
        // eslint-disable-next-line no-console
        console.error(...args);
      },
    };
    return cloudLogger;
  };

  return self;
})();