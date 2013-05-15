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
    _id: value._id,
    name: value.name,
    type: value.type,
    size: value.size,
    data: EJSON.fromJSONValue(value.data),
    start: value.start,
    end: value.end,
    bytesRead: value.bytesRead,
    bytesUploaded: value.bytesUploaded
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
      _id: value._id,
      name: this.name,
      type: this.type,
      size: this.size,
      data: EJSON.toJSONValue(this.data),
      start: value.start,
      end: value.end,
      bytesRead: value.bytesRead,
      bytesUploaded: value.bytesUploaded
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
    },

    rewind: function () {
      this.data = null;
      this.start = 0;
      this.end = 0;
      this.bytesRead = 0;
      this.bytesUploaded = 0;
    },

    upload: function (file, method, options, callback) {
      var self = this;

      if (!Blob.prototype.isPrototypeOf(file))
        throw new Meteor.Error("First parameter must inherit from Blob");

      if (!_.isString(method))
        throw new Meteor.Error("Second parameter must be a Meteor.method name");

      if (arguments.length < 4 && _.isFunction(options)) {
        callback = options;
        options = {};
      }

      options = options || {};
      self.rewind();
      self.size = file.size;

      var readNext = function () {
        if (self.bytesUploaded < self.size) {
          self.read(file, options, function (err, res) {
            if (err && callback)
              callback(err);
            else if (err)
              throw err;
            else {
              Meteor.apply(
                method,
                [self].concat(options.params || []),
                {
                  wait: true
                },
                function (err) {
                  if (err && callback)
                    callback(err);
                  else if (err)
                    throw err;
                  else {
                    self.bytesUploaded += self.data.length;
                    readNext();
                  }
                }
              );
            }
          });
        } else {
          callback && callback(null, self);
        }
      };

      readNext();
      return this;
    }
  });

  _.extend(MeteorFile, {
    read: function (file, options, callback) {
      return new MeteorFile(file).read(file, options, callback);
    },

    upload: function (file, method, options, callback) {
      return new MeteorFile(file).upload(file, method, options, callback);
    }
  });
}
/*****************************************************************************/

/************************ Server *********************************************/
if (Meteor.isServer) {
  var fs = Npm.require('fs');
  var path = Npm.require('path');

  function sanitize (fileName) {
    return fileName
      .replace(/\//g, '')
      .replace(/\.\.+/g, '.')
  }

  _.extend(MeteorFile.prototype, {
    save: function (dirPath, options) {
      var filepath = path.join(dirPath, sanitize(this.name));
      var buffer = new Buffer(this.data);
      var mode = this.start == 0 ? 'w' : 'a';
      var fd = fs.openSync(filepath, mode);
      fs.writeSync(fd, buffer, 0, buffer.length, this.start);
      fs.closeSync(fd);
    }
  });
}
/*****************************************************************************/
