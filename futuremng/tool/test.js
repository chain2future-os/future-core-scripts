//const { createU3 } = require("u3.js");
// const {U3} = require('u3.js');
// const {createU3, format} = U3;


async function runInvokeContract() {
    return 1,2,null;
}

async function test() {
    let a,b = await runInvokeContract();
    console.log(a);
    console.log("test",b);
}

test();
