# Prettier for Jinks
[![NPM
version](https://badge.fury.io/js/prettier-plugin-jinks.svg)](http://badge.fury.io/js/prettier-plugin-jinks)
[![Tests](https://github.com/DrRataplan/prettier-plugin-jinks/actions/workflows/test.yml/badge.svg)](https://github.com/DrRataplan/prettier-plugin-jinks/actions/workflows/ci.yml)
[![Coverage
Status](https://coveralls.io/repos/github/DrRataplan/prettier-plugin-jinks/badge.svg)](https://coveralls.io/github/DrRataplan/prettier-plugin-jinks)

`prettier-plugin-jinks` is a [prettier](https://prettier.io/) plugin for [Jinks
Templating](https://github.com/eeditiones/jinks-templates). `prettier` is an opinionated code
formatter that supports multiple languages and integrates with most editors. The idea is to
eliminate discussions of style in code review and allow developers to get back to thinking about
code design instead.

## Getting started

To run `prettier` with the XQuery plugin, you're going to need
[`node`](https://nodejs.org/en/download/).

If you're using the `npm` CLI, then add the plugin by:

```bash
npm install --save-dev prettier prettier-plugin-jinks
```

Or if you're using `yarn`, then add the plugin by:

```bash
yarn add --dev prettier prettier-plugin-jinks
```

The `prettier` executable is now installed and ready for use:

```bash
npx prettier --plugin=prettier-plugin-jinks --write '**/*.tpl.*'
```

Add a .prettierrc.js to save the configuration
```js
import prettierPluginJinks from 'prettier-plugin-jinks';

/**
 * @type {import('prettier').Config}
 */
const config = {
	useTabs: true,
	printWidth: 120,
	plugins: [prettierPluginJinks],
};

export default config;
```

## Configuration
| API Option                 | CLI Option                     |   Default    | Description                                                                                                              |
| -------------------------- | ------------------------------ | :----------: | ------------------------------------------------------------------------------------------------------------------------ |
| `printWidth`               | `--print-width`                |     `80`     | Same as in Prettier ([see prettier docs](https://prettier.io/docs/en/options.html#print-width)).
| `tabWidth`                 | `--tab-width`                  |     `2`      | Same as in Prettier ([see prettier docs](https://prettier.io/docs/en/options.html#tab-width)).
| `useTabs`                  | `--use-tabs`                   |   `false`    | Same as in Prettier ([see prettier docs](https://prettier.io/docs/en/options.html#tabs)).

Any of these can be added to your existing [prettier configuration
file](https://prettier.io/docs/en/configuration.html). For example:

```json
{
  "tabWidth": 4,
  "plugins": ["prettier-plugin-jinks"]
}
```

Or, they can be passed to `prettier` as arguments:

```bash
prettier --plugin=prettier-plugin-jinks --tab-width 4 --write '**/*.tpl.*'
```

## Contributing

Bug reports and pull requests are welcome on GitHub at
[https://github.com/drrataplan/prettier-plugin-jinks](https://github.com/drrataplan/prettier-plugin-jinks).

## License

The package is available as open source under the terms of the [MIT
License](https://opensource.org/licenses/MIT).
