/**
* testem-multi
*
* @author sideroad
*/
(function(){
  "use strict";

  var exec = require('child_process').exec,
      async = require('async'),
      _ = require('underscore'),
      fs = require('fs');

  exports.exec = function(config, callback){
    var json = process.argv[2] || 'testem-multi.json',
        files,
        output;

    config = config || JSON.parse( fs.readFileSync(json, 'utf-8').replace(/\n/,'')),
    files = config.files || [];
    output = _.extend( {}, {pass : true, fail : true}, config.output );

    delete config.files;
    async.reduce(
      files,
      {
        test: [],
        ok: [],
        pass : 0,
        fail : 0,
        not : [],
        tests : 0,
        version : ""
      },
      function(memo, path, callback){
        config['test_page'] = path;
        fs.writeFileSync('testem.json', JSON.stringify(config));
        exec('testem ci', {}, function( code, stdout, stderr ){
          var result = _.chain(stdout.split('\n')),
            tests = memo.tests,
            test = result.map(function( item ){
              var reg = /^(ok|not ok) (\d+) - ([^\n]+)/,
                  match = item.match(reg);
              return (reg.test(item)) ? match[1]+" "+(Number( match[2] )+tests)+" - "+path+" - "+match[3] :
                     (/^\s+[^\s]+/.test(item)) ? item : false;
            }).compact().value(),
            ok = _.chain(test).map(function( item ){
              return (/^ok \d+ - [^\n]+/.test(item)) ? item : false;
            }).compact().value(),
            pass = ok.length,
            not = _.chain(test).map(function( item ){
              return (/^not ok \d+ - [^\n]+/.test(item)) ? item :
                     (/^\s+[^\s]+/.test(item)) ? item : false;
            }).compact().value(),
            fail = _.chain(not).map(function( item ){
              return (/^not ok \d+ - [^\n]+/.test(item)) ? item : false;
            }).compact().value().length;

          memo.version = result.find(function(item){
            return /^TAP version (\d+)/i.test(item);
          }).value();
          memo.ok = memo.ok.concat(ok);
          memo.pass += pass;
          memo.fail += fail;
          memo.not = memo.not.concat(not);
          memo.tests += pass+fail;
          memo.test = memo.test.concat(test);

          callback(null, memo);
        });
      },
      function(err, memo){
        var tests = memo.tests,
          pass = memo.pass,
          ok = memo.ok,
          fail = memo.fail,
          not = memo.not,
          test = memo.test,
          result = [];

        result.push(memo.version);
        if(!output.pass && output.fail){
          result.push(not.join('\n'));
        } else if(output.pass && !output.fail) {
          result.push(ok.join('\n'));
        } else if(output.pass && output.fail){
          result.push(test.join('\n'));
        }
        result.push('');
        result.push('1..'+ tests);
        result.push('# tests '+ tests );
        result.push('# pass '+ pass );
        result.push('# fail '+ fail );
        callback(result.join('\n'));
      }
    );

  };

})();
