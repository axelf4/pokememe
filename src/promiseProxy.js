/**
 * Returns a proxy that takes records of A+ promises returned from method invocations.
 *
 * The promises are stored as an Array in the "promises" property of the proxy.
 */
module.exports = function(target) {
	var promises = []; // The pending promises
	return new Proxy(target, {
		get: function(target, property, receiver) {
			if (property === "all") {
				return new Promise(function(resolve, reject) {
					(function testPromises() {
						if (promises.length === 0) resolve();
						else {
							var tmp = promises.splice(0); // Clear the array
							Promise.all(tmp).then(testPromises, reject);
						}
					})();
				});
			}

			let value = target[property];
			if (typeof value === "function") {
				return function() {
					let result = value.apply(this, arguments);
					if (result && typeof result.then === "function") {
						// Returned value is a promise
						promises.push(result);
					}
					return result;
				};
			} else {
			   return value;
			}
		}
	});
};