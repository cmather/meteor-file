/************************ FileUploader ***************************************/
FileUploader = function (options) {
  this.options = options || {};
  this.method = options.method;
  this.template = options.template;
  this.files = new Meteor.Collection(null);
};

FileUploader.prototype = {
  constructor: FileUploader,

  render: function (data) {
    if (!this.template) return;

    var self = this;
    var html;

    html = Spark.isolate(function () {
      return self.template(_.extend({
        files: function () {
          return self.files.find();
        }
      }, data || {}));
    });

    html = Spark.attachEvents({
      'change input[type=file]': function (e, tmpl) {
        var fileInput = e.currentTarget;
        var file;
        var mFile;

        for (var i = 0; i < fileInput.files.length; i++) {
          file = fileInput.files[i];
          
          mFile = new MeteorFile(file, {
            collection: self.files
          });

          self.files.insert(mFile.toJSONValue());

          mFile.upload(
            file,
            self.method,
            self.options,
            function (err) {
              if (err) throw err;
            }
          );
        }
      }
    }, html);

    return html;
  }
};
/*****************************************************************************/

/************************ Handlebars *****************************************/
Handlebars.registerHelper('FileUploader', function (options) {
  var uploadOptions = options.hash;

  var uploader = new FileUploader(_.extend({
    template: options.fn
  }, uploadOptions, {
    size: eval(uploadOptions.size)
  }));

  return uploader.render(options.data || {});
});

Handlebars.registerHelper('humanize', function (number, options) {
  return MeteorFile.humanize(number);
});
/*****************************************************************************/

