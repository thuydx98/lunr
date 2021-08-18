# Lunr search engine

This project was developed with [Angular CLI](https://github.com/angular/angular-cli) version 12.0.2.

## Development checklist

- [ ] Update single pattern: Yuza => Yuza* => Yuza~1
- [ ] Update multiple pattern: +Buta +ship +Muncie => +Buta +ship Muncie
- [ ] List out special character that affect search result, then for these: 
    + Try to convert them to Hex code
    + Make sure that during search, if search term contains these special characters, after converting to Hex, single remains single, multiple remains multiple and follow rule 1,2
- [ ] Apply  Levenshtein Distance by default
- [x] Keep CSE, FWU as optional (keep current)
- [x] Keep order by score as optional (keep current)
- [ ] Try lunr language for English, France, German
