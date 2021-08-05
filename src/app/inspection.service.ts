import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InspectionService {
  constructor(private http: HttpClient) {}

  public get(): Observable<any> {
    return this.http.get('./assets/inspections.json');
  }
}
