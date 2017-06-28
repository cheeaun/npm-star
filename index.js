const netrc = require('netrc')();
const token = netrc['api.github.com'].password;

const ora = require('ora');
const got = require('got');
const gh = require('gh-got');

const pkg = JSON.parse(require('fs').readFileSync('package.json'));

const logAuth = ora('Checking authentication').start();
gh('rate_limit', { token }).then(res => {
  logAuth.succeed('Authentication works!');

  const dependencies = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  ora(`Number of dependencies found inside package.json: ${dependencies.length}`).info();

  dependencies.forEach(pkg => {
    const logDep = ora(`Fetching info for package "${pkg}"`).start();
    got('http://registry.npmjs.org/' + pkg).then(res => {
      const data = JSON.parse(res.body);
      const url = data.repository.url;
      const [_, owner, repo] = url.match(/\/([^/]+)\/([^/]+)\.git$/i) || [,null, null];
      const repoName = owner + '/' + repo;

      logDep.text = `Check if ${repoName} is already starred...`;
      gh(`user/starred/${repoName}`, { token }).then(res => {
        logDep.stopAndPersist({
          symbol: '⭐️ ',
          text: `${repoName} is already starred`,
        });
      }).catch(e => {
        logDep.stopAndPersist({
          symbol: '💔 ',
          text: `${repoName} is not starred`,
        });

        const logStar = ora(`Starring ${repoName} now...`).start();
        gh.put(`user/starred/${repoName}`, { token }).then(res => {
          logStar.stopAndPersist({
            symbol: '🌟 ',
            text: `Starred ${repoName} (^_^)b`,
          });
        }).catch(e => {
          logStar.stopAndPersist({
            symbol: '😢 ',
            text: `Unable to star ${repoName}`,
          });
        })
      })
    }).catch(e => {
      logDep.fail(`Failed fetching info for package "${pkg}"`);
    });
  });
}).catch(e => {
  logAuth.fail(`Authentication fails. Set up your .netrc file.`);
});
