class UpsError extends Error {
  constructor(index, message, code = '', description = ''){
    super(index, code, description);
    this.name = this.constructor.name;
    this.index = index;
    this.message = message;
    this.code = code;
    this.description = description;
    Error.captureStackTrace(this, UpsError);
  }
}
module.exports.UpsError = UpsError;

//function test() {
  //try{
    //throw new UpsError("I'm a boy", '123', 'ayou7995');
  //} catch (err) {
    //console.log(err instanceof Error);
    //console.log(err instanceof UpsError);
    //console.log(err.name+' ['+err.code+'] '+err.description);
    //console.log(err.message);
  //}
//}
//test();
