import * as path from 'path';
import Mocha from 'mocha';
import { globSync } from 'glob';

export function run(): Promise<void> {
	// Create the mocha test
	const mochaTest = new Mocha({
		ui: 'tdd',
		color: true
	});

	const testsRoot = path.resolve(__dirname, '..');
	const files = globSync('**/**.test.js', { cwd: testsRoot });

	return new Promise((c, e) => {
		// Add files to the test suite
		files.forEach(f => mochaTest.addFile(path.resolve(testsRoot, f)));

		try {
			// Run the mocha test
			mochaTest.run(failures => {
				if (failures > 0) {
					e(new Error(`${failures} tests failed.`));
				} else {
					c();
				}
			});
		} catch (err) {
			console.error(err);
			e(err);
		}
	});
}
