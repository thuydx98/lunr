export enum SearchBy {
  EXACT,
  START_WITH_SEARCH_KEY,
  START_WITH_FIRST_LETTER,
  CONTAINING_SEARCH_KEY,
  EACH_LETTER_IN_SEARCH_KEY,

  MULTI_EXACT,
  MULTI_START_WITH_SEARCH_KEY,
  MULTI_CONTAIN_ALL_KEY,
  MULTI_START_AND_CONTAIN_ALL_KEY_WORD,
  MULTI_CONTAIN_START_OF_ALL_KEY,
}

export const SearchFunction = [
  {
    key: SearchBy.EXACT,
    title: 'Single: keyword',
    isSingleSearch: true,
    tooltip: 'Match exact',
  },
  {
    key: SearchBy.START_WITH_SEARCH_KEY,
    title: 'Single: keyword*',
    isSingleSearch: true,
    tooltip: 'Start with search key',
  },
  {
    key: SearchBy.START_WITH_FIRST_LETTER,
    title: 'Single: +keyword[0]* +keyword~1 || +keyword[0]* +keyword~1',
    isSingleSearch: true,
    tooltip: 'Start with first letter, allow 2 differences',
  },
  {
    key: SearchBy.CONTAINING_SEARCH_KEY,
    title: 'Single: *keyword*',
    isSingleSearch: true,
    tooltip: 'Match words containing (not start with)',
  },
  {
    key: SearchBy.EACH_LETTER_IN_SEARCH_KEY,
    title: 'Single: k*e*y*w*o*r*d',
    isSingleSearch: true,
    tooltip: 'Match words by each letter, starting with first letter',
  },
  {
    key: SearchBy.MULTI_EXACT,
    title: 'Multiple: Match exact',
    isSingleSearch: false,
    tooltip: 'Match exact',
  },
  {
    key: SearchBy.MULTI_START_WITH_SEARCH_KEY,
    title: 'Multiple: each key word*',
    isSingleSearch: false,
    tooltip: 'Start with keywords',
  },
  {
    key: SearchBy.MULTI_CONTAIN_ALL_KEY,
    title: 'Multiple: +each +key +words',
    isSingleSearch: false,
    tooltip: 'Contains all keywords',
  },
  {
    key: SearchBy.MULTI_START_AND_CONTAIN_ALL_KEY_WORD,
    title: 'Multiple: +each +key +words*',
    isSingleSearch: false,
    tooltip: 'Contains all keywords except last & Start with last keyword',
  },
  {
    key: SearchBy.MULTI_CONTAIN_START_OF_ALL_KEY,
    title: 'Multiple: each* key* words*',
    isSingleSearch: false,
    tooltip: 'Maybe start with some keywords',
  },
];
