import { Component } from '@angular/core';
import { InspectionService } from './inspection.service';
import { TransferItem } from 'ng-zorro-antd/transfer';
import { NzModalService } from 'ng-zorro-antd/modal';
import * as lunr from 'lunr';
import Fuse from 'fuse.js';
import { SearchOption } from './models/app.model';
import { getSimilarityBasedOnDistance, searchExactly } from './app.const';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  timeoutID: any;
  searchKey = '';
  loading = true;
  patterns: TransferItem[] = [];
  rawInspection: any[] = [];
  inspections: any[] = [];
  idx: any;
  fuse: any;
  options: SearchOption = new SearchOption();

  constructor(private appSettingsService: InspectionService, private modal: NzModalService) {}

  ngOnInit() {
    this.appSettingsService.get().subscribe((data) => {
      this.inspections = data;
      this.rawInspection = data;
      this.loading = false;
      this.initLunrIndex(data);
      this.initFuse(data);
    });
  }

  onChangeTransfer(ret: any): void {
    const items = ret.list;
    const titles = items.map((i: any) => i.title);
    this.patterns = this.patterns.filter((item: any) => !titles.includes(item.title));

    this.patterns = this.patterns.concat(items);

    this.loading = true;
    if (this.timeoutID) clearTimeout(this.timeoutID);

    this.timeoutID = setTimeout(() => this.onSearch(), 500);
  }

  onChangeSearchInput(): void {
    this.patterns = [];

    if (this.timeoutID) clearTimeout(this.timeoutID);

    this.timeoutID = setTimeout(() => {
      this.inspections = this.rawInspection;
      this.generateSearchPatterns(this.searchKey);
      this.onSearch();
    }, 500);
  }

  onClearSearch() {
    this.searchKey = '';
    this.patterns = [];
    this.inspections = this.rawInspection;
    this.loading = false;
  }

  onSearch(isChangeScore = false): void {
    this.loading = true;
    const patterns = this.patterns.filter((item) => item.direction === 'right');

    if (!this.searchKey || (patterns.length == 0 && !this.options.useCustomSearch && !this.options.useUpperWord && !this.options.useFuse)) {
      this.inspections = this.rawInspection;
      this.loading = false;
      return;
    }

    let result: any = [];
    const searchKey = this.searchKey?.trim();

    if (this.options.useCustomSearch) {
      const isSingle = searchKey.split(' ').length === 1;
      result = result.concat(searchExactly(searchKey, this.rawInspection, isSingle).map((item: any) => ({ ...item, tooltip: 'custom search', plugin: 'CSE' })));
    }

    if (this.options.useUpperWord) {
      const input = '+' + [...searchKey].join('* +') + '*';
      result = result.concat(this.idx.search(input).map((item: any) => ({ ...item, tooltip: input, plugin: 'FWU' })));
    }

    // if (this.options.useFuse) {
    //   result = result.concat(this.searchFuse(searchKey));
    // }

    patterns.forEach((pattern) => {
      const tooltip = pattern.title;
      try {
        result = result.concat(this.idx.search(tooltip).map((item: any) => ({ ...item, tooltip: pattern.title })));
      } catch (error) {
        this.modal.error({
          nzTitle: 'Pattern format error',
          nzContent: error.name + ': ' + error.message,
        });
      }
    });

    this.inspections = result
      .filter((value: any, index: any, self: any) => self.findIndex((m: any) => m.ref === value.ref) === index)
      .map((item: any) => {
        const insp = this.rawInspection.find((ins) => ins.inspectionId === item.ref);

        const inspection = Object.assign({}, insp);
        if (inspection) {
          if (item.plugin !== 'FUSE') {
            for (const [key] of Object.entries(item.matchData.metadata)) {
              inspection.inspectionLineName = inspection.inspectionLineName.replace(new RegExp(key, 'i'), `<b>$&</b>`);
            }
          }

          inspection.score = +item.score.toFixed(3);
          inspection.inspectionLineName = `<span class="text-danger">` + (item.plugin ? item.plugin + ' ' : '') + (item.score < 100 ? +item.score.toFixed(3).toString() : '') + `</span>: ` + inspection.inspectionLineName;
        }

        return inspection;
      });

    if (this.options.useLevenshtein) {
      this.inspections = this.inspections.sort((ins1: any, ins2: any) => {
        let diff = ins2.score - ins1.score;
        if (diff === 0) {
          diff = getSimilarityBasedOnDistance(this.searchKey, ins2.inspectionLineName) - getSimilarityBasedOnDistance(this.searchKey, ins1.inspectionLineName);
        }
        return diff;
      });
    }

    if (!isChangeScore) {
      const minScore = this.inspections.reduce((min, item) => (min < item.score ? min : item.score), 0);
      const maxScore = this.inspections.reduce((max, item) => (max > item.score ? max : item.score), 0);
      this.options.scoreRange = [minScore, maxScore];
      this.options.scoreSelected = [minScore, maxScore];
    } else {
      this.inspections = this.inspections.filter((item) => this.options.scoreSelected[0] <= item.score && item.score <= this.options.scoreSelected[1]);
    }

    if (this.options.isSortScore) {
      this.inspections = this.inspections.sort((a, b) => (a.score <= b.score && 1) || -1);
    }

    this.loading = false;
  }

  onAddPattern(direction: any): void {
    const pattern = prompt('Please exter the pattern:', '');
    if (pattern) {
      this.patterns = [
        ...this.patterns,
        {
          title: pattern || '',
          direction,
        },
      ];

      if (direction === 'right') this.onSearch();
    }
  }

  onDeletePattern(pattern: any): void {
    this.modal.confirm({
      nzTitle: `Are you sure delete this pattern ${pattern.title}?`,
      nzOkText: 'Yes',
      nzOkType: 'primary',
      nzOkDanger: true,
      nzOnOk: () => {
        this.patterns = this.patterns.filter((item) => item.title !== pattern.title);
        this.onSearch();
      },
      nzCancelText: 'No',
    });
  }

  private generateSearchPatterns(searchKey: string): void {
    searchKey = searchKey
      ?.replace(/\s\s+/g, ' ')
      .replace(/[*+~^:-]/g, '')
      .trim();

    if (!searchKey || searchKey === '') {
      return;
    }

    const patterns: any = [];
    if (searchKey.split(' ').length === 1) {
      patterns.push({ title: searchKey });
      patterns.push({ title: searchKey + '*' });
      patterns.push({ title: searchKey + '~1' });
      patterns.push({ title: '+' + searchKey[0] + '* +' + searchKey + '~1' });
      patterns.push({ title: '+' + searchKey[0] + '* +' + searchKey + '~2' });
      patterns.push({ title: '*' + searchKey + '*' });
      patterns.push({ title: [...searchKey].join('*') + '*' });
    } else {
      patterns.push({ title: '+' + searchKey.split(' ').join(' +') });
      patterns.push({ title: '+' + searchKey.split(' ').join(' +') + '*' });
      patterns.push({ title: searchKey.split(' ').join('* ') + '*' });
      patterns.push({ title: searchKey + '*' });
    }

    this.patterns = patterns;
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

  private initFuse(inspections: any): void {
    this.fuse = new Fuse(inspections, {
      isCaseSensitive: true,
      includeScore: true,
      shouldSort: true,
      includeMatches: true,
      findAllMatches: true,
      // minMatchCharLength: 1,
      // location: 0,
      threshold: 0.6,
      // distance: 100,
      // useExtendedSearch: false,
      // ignoreLocation: false,
      // ignoreFieldNorm: false,
      keys: ['inspectionLineName'],
    });
  }

  private searchFuse(searchKey: string): any[] {
    const result = this.fuse.search(searchKey);
    debugger;
    return result.map((item: any) => ({
      ref: item.item.inspectionId,
      tooltip: 'Fuse.js',
      score: item.score,
      plugin: 'FUS',
    }));
  }
}
