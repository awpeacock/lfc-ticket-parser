import * as fs from 'fs';
import * as cp from 'child_process';
import archiver from 'archiver';

class Builder {

    path = 'lfct-aws-js';

    copyFolder() {
        console.log('+ Copying "dist" folder');
        try {
            fs.cpSync('./dist', '../' + this.path, {recursive: true});
            return true;
        } catch (e) {
            console.log('  !!! Unable to copy folder !!!');
            return false;
        }
    }

    async installDependency(module) {
        try {
            const result = await new Promise((resolve, reject) => {
                cp.exec('npm install ' + module, {cwd: '../' + this.path}, (error, stdout, stderr) => {
                    if ( error ) {
                        reject(error);
                    } else {
                        resolve('  - "' + module + '" Successfully installed');
                    }
                });
            });
            console.log(result);
            return true;
        } catch (e) {
            console.log('  !!! "' + module + '" install failed !!!');
            return false;
        }
    }

    async createZip() {
        console.log('+ Zipping up folder');
        try {
            const target = 'outputs';
            if ( !fs.existsSync(target) ){
                fs.mkdirSync(target);
            }
            const output = fs.createWriteStream('./' + target + '/' + this.path + '.zip');
            output.on('error', function(e){
                return console.log('   !!! Creating the zip file failed !!!');
            });
            const zip = archiver('zip');
            zip.on('error', function(e){
                return console.log('   !!! Building the zip file failed !!!');
            });
            zip.pipe(output);
            zip.directory('../' + this.path, false);
            await zip.finalize();
        } catch (e) {
            console.log('   !!! Zipping the folder failed !!!');
        }
    }

    teardown() {
        console.log('+ Tidying up');
        try {
            fs.rmSync('../lfct-aws-js', {recursive: true, force: true});
        } catch (e) {
            console.log('   !!! Unable to remove folder !!!');
        }
    }

}

const builder = new Builder();
console.log('------------------------------------------------------------');
if ( builder.copyFolder() ) {
    console.log('+ Installing node module dependencies');
    if ( await builder.installDependency('dotenv') && await builder.installDependency('ics') && await builder.installDependency('nodemailer') ) {
        await builder.createZip();
    }
    builder.teardown();
}
console.log('+ Build and bundle of AWS Lambda zip complete');
console.log('----------------------------------------');