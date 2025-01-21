import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RadioSearchHighChartComponent} from './radiosearch-high-chart.component';

describe('RadioSearchHighchartComponent', () => {
  let component: RadioSearchHighChartComponent;
  let fixture: ComponentFixture<RadioSearchHighChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RadioSearchHighChartComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(RadioSearchHighChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
