const {ObjectId} =  require('bson')
function getObjectId() {
  return new ObjectId().toString();
}

module.exports = { getObjectId };
