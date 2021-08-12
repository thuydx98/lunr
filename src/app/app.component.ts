import { Component } from '@angular/core';
import { InspectionService } from './inspection.service';
import { TransferItem } from 'ng-zorro-antd/transfer';
import * as lunr from 'lunr';

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
    }, 500);
  }

  onClearSearch() {
    this.searchKey = '';
    this.patterns = [];
    this.inspections = this.rawInspection;
    this.loading = false;
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
      patterns.push({ title: searchKey + '*' });
      patterns.push({ title: '+' + searchKey.split(' ').join(' +') });
      patterns.push({ title: '+' + searchKey.split(' ').join(' +') + '*' });
      patterns.push({ title: searchKey.split(' ').join('* ') + '*' });
    }

    this.patterns = patterns;
  }

  private onSearch = () => {
    this.loading = true;

    if (this.patterns.length == 0) {
      this.loading = false;
      this.inspections = this.rawInspection;
      return;
    }

    let result: any = [];
    const patterns = this.patterns.filter((item) => item.direction === 'right');

    patterns.forEach((pattern) => {
      const tooltip = pattern.title;
      result = result.concat(this.idx.search(tooltip).map((item: any) => ({ ...item, tooltip: pattern.title })));
    });

    this.inspections = result
      .filter((value: any, index: any, self: any) => self.findIndex((m: any) => m.ref === value.ref) === index)
      .map((item: any) => {
        const insp = this.rawInspection.find((ins) => ins.inspectionId === item.ref);

        const inspection = Object.assign({}, insp);
        if (inspection) {
          inspection.condition = item.condition;
          for (const [key] of Object.entries(item.matchData.metadata)) {
            inspection.inspectionLineName = inspection.inspectionLineName.replace(new RegExp(key, 'i'), `<b>$&</b>`);
          }

          inspection.inspectionLineName = `<span class="text-danger">${item.score === 100 ? 'CSE' : item.score.toFixed(3)}</span>: ` + inspection.inspectionLineName;
        }

        return inspection;
      });

    this.loading = false;
  };

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
}
