export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addWatchTarget('src/css/');
  eleventyConfig.addWatchTarget('src/js/');

  return {
    dir: {
      input: 'src',
      output: 'dist',
      includes: '_includes',
    },
  };
}
