const svc = await fetch("http://192.168.8.1/js/service.js").then((r) => r.text());
const loginIdx = svc.indexOf("login:function");
console.log("login fn:", svc.slice(loginIdx, loginIdx + 1200));

const afterLogin = svc.indexOf('"1"==e.result');
console.log("\nresult 1 handling:", svc.slice(afterLogin - 100, afterLogin + 600));
