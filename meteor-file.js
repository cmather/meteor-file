/************************ Client and Server **********************************/

function defaultZero (value) {
  return _.isUndefined(value) ? 0 : value;
}

MeteorFile = function (options) {
  options = options || {};
  this.name = options.name;
  this.type = options.type;
  this.size = options.size;
  this.data = options.data;

  this.start = defaultZero(options.start);
  this.end = defaultZero(options.end);
  this.bytesRead = defaultZero(options.bytesRead);
  this.bytesUploaded = defaultZero(options.bytesUploaded);

  this._id = options._id || Meteor.uuid();
};

MeteorFile.fromJSONValue = function (value) {
  return new MeteorFile({
    name: value.name,
    type: value.type,
    size: value.size,
    data: EJSON.fromJSONValue(value.data),
    start: value.start,
    end: value.end,
    bytesRead: value.bytesRead,
    bytesUploaded: value.bytesUploaded,
    _id: value._id
  });
};

MeteorFile.prototype = {
  constructor: MeteorFile,

  typeName: function () {
    return "MeteorFile";
  },

  equals: function (other) {
    return other._id == this._id;
  },

  clone: function () {
    return new MeteorFile({
      name: this.name,
      type: this.type,
      size: this.size,
      data: this.data,
      start: value.start,
      end: value.end,
      bytesRead: value.bytesRead,
      bytesUploaded: value.bytesUploaded,
      _id: value._id
    });
  },

  toJSONValue: function () {
    return {
      name: this.name,
      type: this.type,
      size: this.size,
      data: EJSON.toJSONValue(this.data),
      start: value.start,
      end: value.end,
      bytesRead: value.bytesRead,
      bytesUploaded: value.bytesUploaded,
      _id: value._id
    };
  }
};

EJSON.addType("MeteorFile", MeteorFile.fromJSONValue);
/*****************************************************************************/

/************************ Client *********************************************/
if (Meteor.isClient) {
  _.extend(MeteorFile.prototype, {
    read: function (file, options, callback) {

      if (arguments.length == 2)
        callback = options;

      options = options || {};

      var reader = new FileReader;
      var self = this;
      var chunkSize = options.size || 1024 * 1024 * 2; /* 2MB */

      callback = callback || function () {};

      self.size = file.size;
      self.start = self.end;
      self.end += chunkSize;

      if (self.end > self.size)
        self.end = self.size;

      reader.onload = function () {
        self.bytesRead += self.end - self.start;
        self.data = new Uint8Array(reader.result);
        callback && callback(null, self);
      };

      reader.onerror = function () {
        callback && callback(reader.error);
      };

      if ((this.end - this.start) > 0) {
        var blob = file.slice(self.start, self.end);
        reader.readAsArrayBuffer(blob);
      }

      return this;
    }
  });

  _.extend(MeteorFile, {
    read: function (file, options, callback) {
      return new MeteorFile(file).read(file, options, callback);
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
/*****************************************************************************/
