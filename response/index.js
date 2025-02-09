const response = (success, error, message = null, displayContent = true) => {
  return {
    success,
    error,
    message: {
      content: message,
      displayContent: displayContent
    },
  };
};

module.exports = { response };
