import { Component } from '@angular/core';
import { InspectionService } from './inspection.service';
import { TransferItem } from 'ng-zorro-antd/transfer';
import { NzModalService } from 'ng-zorro-antd/modal';
import * as Lunr from 'lunr';
import Fuse from 'fuse.js';
import { SearchOption } from './models/app.model';
import { similarity, searchExactly, SPECIAL_CHARACTERS } from './app.const';

const trimmer = function (token: any) {
  return token.update(function (s: any) {
    return s;
  });
};

Lunr.Pipeline.registerFunction(trimmer, 'trimmer');

type LunrIndex = (config: Lunr.ConfigFunction) => Lunr.Index;
type LunrType = LunrIndex & {
  de: any;
  fr: any;
};

const lunr: LunrType = require('lunr');
require('lunr-languages/lunr.stemmer.support.js')(lunr);
require('lunr-languages/lunr.multi.js')(lunr);
require('lunr-languages/lunr.de.js')(lunr);
require('lunr-languages/lunr.fr.js')(lunr);

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  SPECIAL_CHARACTERS = SPECIAL_CHARACTERS;
  timeoutID: any;
  searchKey = '';
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
      this.initLunrIndex(data);
      // this.initFuse(data);
    });
  }

  onChangeTransfer(ret: any): void {
    const items = ret.list;
    const titles = items.map((i: any) => i.title);
    this.patterns = this.patterns.filter((item: any) => !titles.includes(item.title));

    this.patterns = this.patterns.concat(items);

    if (this.timeoutID) clearTimeout(this.timeoutID);

    this.timeoutID = setTimeout(() => this.onSearch(), 500);
  }

  onChangeSearchInput(): void {
    this.patterns = [];

    if (this.timeoutID) clearTimeout(this.timeoutID);

    this.timeoutID = setTimeout(() => {
      this.inspections = this.rawInspection;
      this.options.useLevenshtein = true;
      this.generateSearchPatterns(this.searchKey);
      this.onSearch();
    }, 500);
  }

  onClearSearch() {
    this.options.useLevenshtein = true;
    this.searchKey = '';
    this.patterns = [];
    this.inspections = this.rawInspection;
  }

  onSearch(isChangeScore = false): void {
    const patterns = this.patterns.filter((item) => item.direction === 'right');

    if (!this.searchKey || (patterns.length == 0 && !this.options.useCustomSearch && !this.options.useUpperWord && !this.options.useFuse)) {
      this.inspections = this.rawInspection;
      return;
    }

    let result: any = [];
    const searchKey = this.searchKey?.trim();

    if (this.options.useCustomSearch) {
      const isSingle = searchKey.split(' ').length === 1;
      result = result.concat(searchExactly(searchKey, this.rawInspection, isSingle).map((item: any) => ({ ...item, tooltip: 'CSE: custom search exact', plugin: 'CSE' })));
    }

    if (this.options.useUpperWord && searchKey === searchKey.toUpperCase()) {
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
          inspection.score = +item.score.toFixed(3);
          inspection.tooltip = item.tooltip;
          inspection.rawName = inspection.inspectionLineName;

          if (item.plugin !== 'FUSE') {
            for (const [key] of Object.entries(item.matchData.metadata)) {
              inspection.inspectionLineName = inspection.inspectionLineName.replace(new RegExp(key, 'i'), `<b>$&</b>`);
            }
          }

          inspection.inspectionLineName = `<span class="text-danger">` + (item.plugin ? item.plugin + ' ' : '') + (item.score < 100 ? +item.score.toFixed(3).toString() : '') + `</span>: ` + inspection.inspectionLineName;
        }

        return inspection;
      });

    if (this.options.useLevenshtein) {
      for (let i = 0; i < this.inspections.length - 1; i++) {
        for (let j = i + 1; j < this.inspections.length; j++) {
          const ins1 = this.inspections[i];
          const ins2 = this.inspections[j];

          if (ins1.score !== ins2.score || ins1.tooltip !== ins2.tooltip) break;

          if (similarity(this.searchKey, ins2.rawName) > similarity(this.searchKey, ins1.rawName)) {
            const temp = this.inspections[i];
            this.inspections[i] = ins2;
            this.inspections[j] = temp;
          }
        }
      }
    }

    if (!isChangeScore) {
      this.options.minScore = 0;
    } else {
      this.inspections = this.inspections.filter((item) => this.options.minScore <= item.score);
    }

    if (this.options.isSortScore) {
      this.inspections = this.inspections.sort((a, b) => (a.score <= b.score && 1) || -1);
    }
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

  onUseLunrLanguages(): void {
    this.initLunrIndex(this.rawInspection);
    this.onSearch();
  }

  private generateSearchPatterns(searchKey: string): void {
    searchKey = searchKey?.replace(/\s\s+/g, ' ').trim();

    if (!searchKey || searchKey === '') {
      return;
    }

    SPECIAL_CHARACTERS.forEach((item) => {
      searchKey = searchKey.split(item.key).join(item.value);
    });

    const patterns: any = [];
    if (searchKey.split(' ').length === 1) {
      patterns.push({ title: searchKey });
      patterns.push({ title: searchKey + '*' });
      patterns.push({ title: searchKey + '~1' });

      /** removed in new version
      patterns.push({ title: '+' + searchKey[0] + '* +' + searchKey + '~1' });
      patterns.push({ title: '+' + searchKey[0] + '* +' + searchKey + '~2' });
      patterns.push({ title: '*' + searchKey + '*' });
      patterns.push({ title: [...searchKey].join('*') + '*' });
       */
    } else {
      const words = searchKey.split(' ');
      patterns.push({ title: '+' + words.join(' +') });
      patterns.push({ title: '+' + words.slice(0, words.length - 1).join(' +') + ' ' + words[words.length - 1] });

      /** removed in new version
      patterns.push({ title: '+' + searchKey.split(' ').join(' +') + '*' });
      patterns.push({ title: searchKey.split(' ').join('* ') + '*' });
      patterns.push({ title: searchKey + '*' });
       */
    }

    this.patterns = patterns;
  }

  private initLunrIndex(inspections: any): void {
    const isUseLunrLanguages = this.options.useLunrLanguages;
    this.idx = lunr(function () {
      if (isUseLunrLanguages) {
        this.use(lunr.fr, lunr.de);
      }

      this.ref('inspectionId');
      this.field('inspectionLineName');
      this.metadataWhitelist = ['position', 'tokenLength'];

      inspections.forEach((ins: any) => {
        let inspectionLineName = ins.inspectionLineName;
        SPECIAL_CHARACTERS.forEach((item) => {
          inspectionLineName = inspectionLineName.split(item.key).join(item.value);
        });

        this.add({ ...ins, inspectionLineName });
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
