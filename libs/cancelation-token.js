function createCancellationToken() {
  let isCancelled = false;

  function cancel() {
    isCancelled = true;
  }

  return {
    isCancelled: () => isCancelled,
    cancel: cancel,
  };
}

module.exports = { createCancellationToken };
