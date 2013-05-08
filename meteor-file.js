/************************ Client and Server **********************************/
MeteorFile = function (options) {
  options = options || {};
  this.name = options.name;
  this.type = options.type;
  this.size = options.size;
  this.data = options.data;
};

MeteorFile.fromJSONValue = function (value) {
  return new MeteorFile({
    name: value.name,
    type: value.type,
    size: value.size,
    data: EJSON.fromJSONValue(value.data)
  });
};

MeteorFile.prototype = {
  constructor: MeteorFile,

  typeName: function () {
    return "MeteorFile";
  },

  equals: function (other) {
    return
      this.name == other.name &&
      this.type == other.type &&
      this.size == other.size;
  },

  clone: function () {
    return new MeteorFile({
      name: this.name,
      type: this.type,
      size: this.size,
      data: this.data
    });
  },

  toJSONValue: function () {
    return {
      name: this.name,
      type: this.type,
      size: this.size,
      data: EJSON.toJSONValue(this.data)
    };
  }
};

EJSON.addType("MeteorFile", MeteorFile.fromJSONValue);
/*****************************************************************************/

/************************ Client *********************************************/
if (Meteor.isClient) {
  _.extend(MeteorFile.prototype, {
    read: function (file, callback) {
      var reader = new FileReader;
      var self = this;

      callback = callback || function () {};

      self.size = file.size;

      reader.onload = function () {
        self.data = new Uint8Array(reader.result);
        callback(null, self);
      };

      reader.onerror = function () {
        callback(reader.error);
      };

      reader.readAsArrayBuffer(file);
    }
  });

  _.extend(MeteorFile, {
    read: function (file, callback) {
      return new MeteorFile(file).read(file, callback);
    }
  });
}
/*****************************************************************************/

/************************ Server *********************************************/
if (Meteor.isServer) {
  var fs = Npm.require('fs');
  var path = Npm.require('path');

  _.extend(MeteorFile.prototype, {
    save: function (dirPath, options) {
      var filepath = path.join(dirPath, this.name);
      var buffer = new Buffer(this.data);
      fs.writeFileSync(filepath, buffer, options);
    }
  });
}
/*****************************************************************************/
