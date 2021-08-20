# Lunr search engine

This project was developed with [Angular CLI](https://github.com/angular/angular-cli) version 12.0.2.

## Development checklist

- [x] Update single pattern: Yuza => Yuza* => Yuza~1
- [x] Update multiple pattern: +Buta +ship +Muncie => +Buta +ship Muncie
- [x] List out special character that affect search result, then for these: 
    + Try to convert them to Hex code
    + Make sure that during search, if search term contains these special characters, after converting to Hex, single remains single, multiple remains multiple and follow rule 1,2
- [x] Apply  Levenshtein Distance by default
- [x] Keep CSE, FWU as optional (keep current)
- [x] Keep order by score as optional (keep current)
- [x] Try lunr language for English, France, German
- [x] Add unicode normalizer

## Improvement checklist
- [ ] Create/Delete for input resource data
- [ ] Update to ng zorro modal when input new pattern
- [x] Find & fix the cause the UI freeze (1-3s) when re-render a big list data.