import { Component } from '@angular/core';
import { InspectionService } from './inspection.service';
import { TransferItem } from 'ng-zorro-antd/transfer';
import { SearchFunction, SearchBy } from './app.const';
import * as lunr from 'lunr';
import { isNgTemplate } from '@angular/compiler';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  timeoutID: any;
  searchKey = '';
  isSingleSearch?: boolean = undefined;
  loading = true;
  conditions: TransferItem[] = SearchFunction;
  rawInspection: any[] = [];
  inspections: any[] = [];
  idx: any;
  constructor(private appSettingsService: InspectionService) {}

  ngOnInit() {
    this.appSettingsService.get().subscribe((data) => {
      this.inspections = data;
      this.rawInspection = data;
      this.loading = false;
      this.initLunrIndex(data);
    });
  }

  onChangeTransfer(ret: any): void {
    const items = ret.list;
    const keys = items.map((i: any) => i.key);
    this.conditions = this.conditions.filter((item: any) => !keys.includes(item.key));

    this.conditions = this.conditions.concat(items);

    this.loading = true;
    if (this.timeoutID) clearTimeout(this.timeoutID);

    this.timeoutID = setTimeout(() => this.onSearch(this.searchKey), 500);
  }

  onChangeSearchInput(): void {
    this.loading = true;
    if (this.timeoutID) clearTimeout(this.timeoutID);

    this.timeoutID = setTimeout(() => this.onSearch(this.searchKey), 500);
  }

  private onSearch = (searchText: string) => {
    // remove all *+~^:-, replace multiple-space
    this.loading = true;
    searchText = searchText
      ?.replace(/\s\s+/g, ' ')
      .replace(/[*+~^:-]/g, '')
      .trim();

    if (!searchText || searchText === '') {
      this.inspections = this.rawInspection;
      this.loading = false;
      this.isSingleSearch = undefined;
      this.orderSelectedConditions();
      return;
    }

    if (searchText !== undefined) {
      let searchKey;
      let result: any = [];
      const cons = this.conditions.filter((item) => item.direction === 'right');

      cons.forEach((condition) => {
        let searchValues = [];
        let keywords = searchText;
        const message = SearchFunction.find((i) => i.key == condition.key)?.title;

        if (keywords.split(' ').length === 1) {
          this.isSingleSearch = true;

          if (condition.key === SearchBy.EXACT) {
            // 1. keyword - Match exact
            searchValues = this.pluginSearchExactly(keywords, this.rawInspection);
            searchValues = searchValues.concat(this.idx.search(keywords));
          }

          if (condition.key === SearchBy.START_WITH_SEARCH_KEY) {
            // 2. keyword* - Start with search key
            searchKey = keywords + '*';
            searchValues = this.idx.search(searchKey);
          }

          if (condition.key === SearchBy.START_WITH_FIRST_LETTER) {
            // 3. +keyword[0]* +keyword~1 || +keyword[0]* +keyword~1 - Start with first letter, allow 2 differences
            searchKey = '+' + keywords[0] + '* +' + keywords + '~1';
            searchValues = this.idx.search(searchKey);
            searchKey = '+' + keywords[0] + '* +' + keywords + '~2';
            searchValues = searchValues.concat(this.idx.search(searchKey));
          }

          if (condition.key === SearchBy.CONTAINING_SEARCH_KEY) {
            // *keyword* - Match words containing (not start with)
            searchKey = '*' + keywords + '*';
            searchValues = this.idx.search(searchKey);
          }

          if (condition.key === SearchBy.EACH_LETTER_IN_SEARCH_KEY) {
            // 5. k*e*y*w*o*r*d - Match words by each letter, starting with first letter
            searchKey = [...keywords].join('*') + '*';
            searchValues = this.idx.search(searchKey);
          }
        } else {
          this.isSingleSearch = false;

          if (condition.key === SearchBy.MULTI_EXACT) {
            // 1. Match exact
            searchValues = this.pluginSearchExactly(keywords, this.rawInspection).concat(this.pluginSearchExactly(keywords, this.rawInspection, false));
          }

          if (condition.key === SearchBy.MULTI_START_WITH_SEARCH_KEY) {
            // Match: keyword*
            searchKey = keywords + '*';
            searchValues = this.idx.search(searchKey);
          }

          if (condition.key === SearchBy.MULTI_CONTAIN_ALL_KEY) {
            // Match: +each +key +words
            keywords = '+' + keywords.split(' ').join(' +');
            searchValues = this.idx.search(keywords);
          }

          if (condition.key === SearchBy.MULTI_START_AND_CONTAIN_ALL_KEY_WORD) {
            // Match: +each +key +words*
            searchKey = '+' + keywords.split(' ').join(' +') + '*';
            searchValues = this.idx.search(keywords);
          }

          if (condition.key === SearchBy.MULTI_CONTAIN_START_OF_ALL_KEY) {
            // Match: each* key* words*
            searchKey = keywords.split(' ').join('* ') + '*';
            searchValues = this.idx.search(keywords);
          }
        }

        result = result.concat(searchValues.map((item: any) => ({ ...item, condition: message })));
      });

      this.inspections = result
        .filter((value: any, index: any, self: any) => self.findIndex((m: any) => m.ref === value.ref) === index)
        .map((item: any) => {
          const insp = this.rawInspection.find((ins) => ins.inspectionId === item.ref);

          const inspection = Object.assign({}, insp);
          if (inspection) {
            inspection.condition = item.condition;
            inspection.inspectionLineName = `<span class="text-danger">${item.score === 100 ? item.score : item.score.toFixed(2)}</span>: ` + inspection.inspectionLineName;

            for (const [key] of Object.entries(item.matchData.metadata)) {
              inspection.inspectionLineName = inspection.inspectionLineName.replace(new RegExp(key, 'i'), `<b>$&</b>`);
            }
          }

          return inspection;
        });

      this.loading = false;
    }

    this.orderSelectedConditions();
  };

  private orderSelectedConditions(): void {
    let singleIndex = 1;
    let multiIndex = 1;
    this.conditions.forEach((con) => {
      con.index = '';
      if (this.searchKey && con.direction === 'right' && this.isSingleSearch !== undefined) {
        con.index = con.isSingleSearch ? singleIndex++ : multiIndex++;
      }
    });
  }

  private initLunrIndex(inspections: any): void {
    const trimmer = function (token: any) {
      return token.update(function (s: any) {
        return s;
        // return s.replace(/^\W+/, '').replace(/\W+$/, '');
      });
    };

    lunr.Pipeline.registerFunction(trimmer, 'trimmer');

    this.idx = lunr(function () {
      this.ref('inspectionId');
      this.field('inspectionLineName');
      this.metadataWhitelist = ['position', 'tokenLength'];
      inspections.forEach((ins: any) => {
        this.add(ins);
      });
    });
  }

  private pluginSearchExactly(keywords: string, source: any, isSingleWord = true) {
    const result: any = [];
    const key = keywords.toLowerCase();
    const exactKeywordRegex = isSingleWord ? new RegExp(`[\\s]${key}$|^${key}[\\s]|[\\s]${key}[\\s]|^${key}$`) : new RegExp(`${key}`);
    source.forEach((i: any) => {
      const name = i.inspectionLineName.toLowerCase();
      if (exactKeywordRegex.test(name)) {
        let index = 0;
        let startIndex = 0;
        const position = [];
        while ((index = name.indexOf(key, startIndex)) > -1) {
          position.push(index);
          startIndex = index + keywords.length;
        }
        const metadata: any = {};
        metadata[key] = { inspectionLineName: { position } };
        result.push({
          matchData: { metadata },
          ref: i.inspectionId,
          score: 100,
        });
      }
    });
    return result;
  }
}
