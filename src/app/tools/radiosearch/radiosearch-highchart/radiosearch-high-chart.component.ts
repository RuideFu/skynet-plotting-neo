import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import * as Highcharts from 'highcharts';
import { RadioSearchHighChartService } from '../radiosearch.service';
import { Subject, takeUntil } from 'rxjs';
import { log } from 'console';

@Component({
  selector: 'app-radiosearch-highchart',
  templateUrl: './radiosearch-high-chart.component.html',
  styleUrls: ['./radiosearch-high-chart.component.scss']
})
export class RadioSearchHighChartComponent implements AfterViewInit, OnDestroy {
  Highcharts: typeof Highcharts = Highcharts;
  updateFlag: boolean = true;
  paramData: any = null;

  chartConstructor: string = "chart";
  chartObject!: Highcharts.Chart;

  chartOptions: Highcharts.Options = {
    chart: {
      animation: false,
      styledMode: true,
    },
    title: {
      useHTML: true  // Allow HTML in the chart title
    },
    legend: {
      align: 'center',
    },
    tooltip: {
      enabled: true,
      shared: true,
    },
    exporting: {
      buttons: {
        contextButton: {
          enabled: false,
        }
      }
    },
    xAxis: {
      type: 'logarithmic', // Log scale for x-axis
      title: {
        text: 'Frequency (Hz)'
      },
      min: 0.1
    },
    yAxis: {
      type: 'logarithmic', // Log scale for y-axis
      title: {
        text: 'Flux Density (Jy)'
      },
      min: 0.1
    }
  };


  private destroy$: Subject<any> = new Subject<any>();

  constructor(private service: RadioSearchHighChartService) {
    this.setChartTitle();
    this.setChartXAxis();
    this.setChartYAxis();
  }

  chartInitialized($event: Highcharts.Chart) {
    this.chartObject = $event;
  }

  ngAfterViewInit(): void {
    this.setChartSeries();

    // React to chart information changes
    this.service.chartInfo$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      // this.setChartYAxis();
      this.setChartXAxis();
      this.setChartTitle();
      this.updateChart();
    });

    // React to data changes
    this.service.data$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.animateSeriesUpdate();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  private updateChart(): void {
    this.updateFlag = true;
  }

  private setChartTitle(): void {
    // const titleText = this.service.getChartTitle(); // Get the full title text
    const titleText = 'Results for Radio Source'

    let linkText = '';
    let hyperlink = '';

    if (this.paramData && this.paramData[0] && this.paramData[0][1] && this.paramData[0][1] !== 0.1) {
        linkText = this.paramData[0][1]; // The part of the title that should be clickable
        hyperlink = 'https://vizier.cds.unistra.fr/viz-bin/VizieR-5?-ref=VIZ6684740f2d87a&-out.add=.&-source=VIII/1A/3c&recno=' + linkText; // Set your hyperlink URL
    }

    const clickablePart = linkText
        ? ` <a href="${hyperlink}" target="_blank" style="text-decoration: underline; color: blue;">${linkText}</a>`
        : '';

    this.chartOptions.title = {
        text: `${titleText}${clickablePart}`,
        useHTML: true
    };
  }


  private setChartSeries(): void {
    const frequencyFluxData = this.processData(this.service.getDataArray());

    // Clear any existing series before adding a new one
    if (this.chartObject && this.chartObject.series.length > 0) {
      this.chartObject.series[0].remove(false);
    }

    // Add a new series with animation enabled
    this.chartObject?.addSeries({
      name: "Frequency vs Flux",
      type: 'line',
      data: frequencyFluxData,
      marker: {
        enabled: true,
        symbol: 'circle',
        radius: 4
      },
      animation: {
        duration: 2000,  // 2 seconds duration for drawing the line
        easing: 'easeOut'
      }
    }, true);
  }


  private animateSeriesUpdate(): void {
    // Clear all existing series before adding the new data
    while (this.chartObject?.series.length) {
        this.chartObject.series[0].remove(false); // Remove each series without redrawing yet
    }

    const frequencyFluxData = this.processData(this.service.getDataArray());
    this.paramData = this.processData(this.service.getParamDataArray());

    // Separate data points for y (actual) and fit (line of best fit)
    const actualData = frequencyFluxData.map((point) => ({
        x: point[0],
        y: point[1]
    }));

    const fitData = frequencyFluxData.map((point) => ({
        x: point[0],
        y: point[2]
    }));

    // Calculate the minimum and maximum y coordinates from actualData
    const minY = Math.min(...actualData.map((point) => point.y));
    const maxY = Math.max(...actualData.map((point) => point.y));

    // Get the x coordinate from the first value in paramData
    const xCoordinate = this.paramData[0][0];

    // Create the fitLine array with two points
    const fitLine = [
        { x: Number(xCoordinate.toFixed(3)), y: Number((minY * 1000).toFixed(3)) },
        { x: Number(xCoordinate.toFixed(3)), y: Number((maxY / 1000).toFixed(3)) }
    ];

    const filteredActualData = actualData.filter(point => point.x !== this.paramData[0][0]);

    // Determine whether to enable animation based on data length
    const enableAnimation = actualData.length > 1;

    // Add the actual data series (scatter)
    this.chartObject?.addSeries({
        name: "Actual",
        type: 'scatter',
        data: filteredActualData,
        marker: {
            enabled: true,
            symbol: 'circle',
            radius: 4,
            fillColor: '#007bff'
        },
        lineWidth: 1,
        animation: enableAnimation ? { duration: 2000, easing: 'easeOut' } : false // Disable animation if only 1 point
    }, false); // No redraw yet

    // Round the y values in fitData to 1 decimal place
    const roundedFitData = fitData.map(point => ({
      x: point.x,
      y: parseFloat(point.y.toFixed(1)) // Round y to 1 decimal place
    }));

    // Add the fit data series (scatter for the fit)
    this.chartObject?.addSeries({
      name: "Fit",
      type: 'scatter',
      data: roundedFitData, // Use rounded data
      marker: {
          enabled: true,
          symbol: 'triangle',
          radius: 4,
          fillColor: '#007bff'
      },
      lineWidth: 1,
      animation: enableAnimation ? { duration: 2000, easing: 'easeOut' } : false // Disable animation if only 1 point
    }, false);

    // Add the fit line series (dashed line)
    this.chartObject?.addSeries({
        name: "Target Frequency",
        type: 'line',
        data: fitLine,
        marker: {
            enabled: false
        },
        lineWidth: 0.5,
        dashStyle: 'Dash',
        animation: enableAnimation ? { duration: 2000, easing: 'easeOut' } : false // Disable animation if only 1 point
    }, false); 

    // Update y-axis range
    this.chartOptions.yAxis = {
        title: { text: this.service.getYAxisLabel() },
        min: Math.min(...actualData.map(point => point.y)) / 4,
        max: Math.max(...actualData.map(point => point.y)) * 4
    };

    // Apply chart updates and force a single redraw
    this.chartObject?.update(this.chartOptions, false); // Update chart options without redrawing
    this.chartObject?.redraw(); // Perform a single redraw
}


  private setChartXAxis(): void {
    this.chartOptions.xAxis = {
      title: { text: this.service.getXAxisLabel() },
      type: 'logarithmic', // Set x-axis to logarithmic scale
    };
  }
  
  private setChartYAxis(): void {
    this.chartOptions.yAxis = {
      title: { text: this.service.getYAxisLabel() },
      type: 'logarithmic', // Set y-axis to logarithmic scale
    };
  }

  private processData(data: number[][]): number[][] {
    return data.filter((value: number[]) => {
      return value[0] > 0 && value[1] > 0; // Exclude non-positive values
    }).sort((a: number[], b: number[]) => {
      return a[0] - b[0];
    });
  }  
}
