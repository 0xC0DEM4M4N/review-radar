export default function (eleventyConfig) {
  // Pass through assets
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('css');
  eleventyConfig.addPassthroughCopy('js');

  // Watch targets for dev
  eleventyConfig.addWatchTarget('css/');
  eleventyConfig.addWatchTarget('js/');
  eleventyConfig.addWatchTarget('assets/');

  return {
    dir: {
      input: 'src',
      output: 'dist',
      includes: '_includes',
    },
  };
}
