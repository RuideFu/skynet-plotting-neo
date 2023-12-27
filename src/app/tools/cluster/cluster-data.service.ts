import {Injectable} from '@angular/core';
import {ClusterDataSourceService} from "./data-source/cluster-data-source.service";
import {Astrometry, Catalogs, FILTER, filterWavelength, FSR, Source} from "./cluster.util";
import {HttpClient} from "@angular/common/http";
import {Subject, takeUntil} from "rxjs";
import {Job, JobType} from "../../shared/job/job";

import {environment} from "../../../environments/environment";
import {appendFSRResults, updateClusterFieldSources} from "./cluster-data.service.util";
import {ClusterStorageService} from "./storage/cluster-storage.service";
import {FsrParameters} from "./FSR/fsr.util";

@Injectable()
export class ClusterDataService {
    private sources: Source[] = []; // always sorted in ascending order by id
    private userSources: Source[] | null = null; // user uploaded photometry
    private cluster_sources: Source[] | null = [];
    private field_sources: Source[] | null = [];
    private filters: FILTER[] = [];
    private sourcesSubject = new Subject<Source[]>();
    public sources$ = this.sourcesSubject.asObservable();
    private clusterSourcesSubject = new Subject<Source[]>();
    public clusterSources = this.clusterSourcesSubject.asObservable();

    constructor(
        private http: HttpClient,
        private dataSourceService: ClusterDataSourceService,
        private storageService: ClusterStorageService) {
        this.initValues();
        this.dataSourceService.rawData$.subscribe(
            () => {
                this.sources = this.dataSourceService.getSources();
                this.filters = this.dataSourceService.getFilters();
            }
        );
    }

    public reset() {
        this.storageService.resetDataSource();
        this.initValues();
    }

    public getSources(isCluster: boolean = false): Source[] {
        if (isCluster && this.clusterSources !== null)
            return this.cluster_sources!;
        return this.sources;
    }

    public setFSRCriteria(fsr: FsrParameters) {
        const result = updateClusterFieldSources(this.sources, fsr);
        this.cluster_sources = result.fsr;
        this.field_sources = result.not_fsr;
        this.clusterSourcesSubject.next(this.cluster_sources);
    }

    public getFilters(): FILTER[] {
        return this.filters;
    }

    public setSources(sources: Source[], catalogJobId: number | null = null) {
        this.sources = [];
        for (const source of sources) {
            if (source.fsr == null || source.fsr.distance == null || source.fsr.pm_ra == null || source.fsr.pm_dec == null)
                continue;
            source.photometries = source.photometries.filter((photometry) => {
                return (!isNaN(photometry.mag) && !isNaN(photometry.mag_error) && photometry.filter in FILTER);
            }).sort((a, b) => {
                return filterWavelength[a.filter] - filterWavelength[b.filter]
            });
            this.sources.push(source);
        }
        this.filters = this.generateFilterList();
        this.sourcesSubject.next(this.sources);
    }

    public setFilters(filters: FILTER[]) {
        this.filters = filters;
    }

    public syncUserPhotometry(jobId: number) {
        this.userSources = this.sources;
    }

    public getUserPhotometry(): Source[] | null {
        return this.userSources;
    }

    public getAstrometry(): { id: string, astrometry: Astrometry }[] {
        return this.sources.map((source) => {
            return {id: source.id, astrometry: source.astrometry, photometries: source.photometries};
        })
    }

    fetchCatalog(ra: number, dec: number, radius: number, catalogs: Catalogs[]): Job {
        const catalogJob = new Job('/cluster/catalog', JobType.FETCH_CATALOG, this.http, 200);
        let payload: any = {
            ra: ra,
            dec: dec,
            radius: radius,
            catalogs: catalogs,
        }
        if (this.userSources !== null && this.userSources.length > 0)
            payload['sources'] = this.userSources
        if (this.storageService.getFsrParams() !== null)
            payload['constraints'] = this.storageService.getFsrParams();
        catalogJob.createJob(payload);
        catalogJob.update$.pipe(
            takeUntil(catalogJob.complete$)
        ).subscribe((job) => {
            this.storageService.setJob(job.getStorageObject());
        });
        catalogJob.complete$.subscribe(
            (complete) => {
                if (complete) {
                    this.getCatalogResults(catalogJob.getJobId());
                    // this.storageService.setJob(catalogJob.getStorageObject());
                }
            });
        return catalogJob;
    }

    fetchFieldStarRemoval(): Job {
        const fsrJob = new Job('/cluster/fsr', JobType.FIELD_STAR_REMOVAL, this.http, 200);
        fsrJob.createJob({sources: this.getAstrometry()});
        fsrJob.update$.pipe(
            takeUntil(fsrJob.complete$)
        ).subscribe((job) => {
            this.storageService.setJob(job.getStorageObject());
        });
        fsrJob.complete$.subscribe(
            (complete) => {
                if (complete) {
                    this.getFSRResults(fsrJob.getJobId());
                }
            });
        return fsrJob;
    }

    public getCatalogResults(id: number | null) {
        if (id !== null)
            this.http.get(`${environment.apiUrl}/cluster/catalog`,
                {params: {'id': id}}).subscribe(
                (resp: any) => {
                    // const {sources, filters} = sourceSerialization(resp['output_sources']);
                    const sources: Source[] = resp['output_sources'];
                    this.setSources(sources, resp['id']);
                }
            );
    }

    public getFSRResults(id: number | null) {
        if (id !== null)
            this.http.get(`${environment.apiUrl}/cluster/fsr`,
                {params: {'id': id}}).subscribe(
                (resp: any) => {
                    this.setSources(appendFSRResults(resp['sources'], resp['FSR']));
                    this.syncUserPhotometry(resp['id']);
                    console.log(this.sources);
                }
            );
    }

    // in kparsec not parsec
    getDistance(full: boolean = false): (number)[] {
        const data = (full || this.cluster_sources == null) ? this.sources : this.cluster_sources;
        return data.filter(
            (source) => {
                return source.fsr !== null && source.fsr.distance !== null;
            }
        ).map((source) => {
            return parseFloat((source.fsr!.distance / 1000).toFixed(2));
        }).sort((a, b) => {
            return a - b;
        });
    }

    getPmra(full: boolean = false): number[] {
        const data = (full || this.cluster_sources == null) ? this.sources : this.cluster_sources;
        return data.filter(
            (source) => {
                return source.fsr !== null && source.fsr.pm_ra !== null;
            }
        ).map((source) => {
            return parseFloat((source.fsr!.pm_ra).toFixed(2));
        }).sort((a, b) => {
            return a - b;
        });
    }

    getPmdec(full: boolean = false): number[] {
        const data = (full || this.cluster_sources == null) ? this.sources : this.cluster_sources;
        return data.filter(
            (source) => {
                return source.fsr !== null && source.fsr.pm_dec !== null;
            }
        ).map((source) => {
            return parseFloat((source.fsr!.pm_dec).toFixed(2));
        }).sort((a, b) => {
            return a - b;
        });
    }

    get2DpmChartData(): { cluster: number[][], field: number[][] } {
        if (this.cluster_sources == null || this.field_sources == null)
            return {cluster: [], field: []};
        const cluster = this.cluster_sources.filter(
            (source) => {
                return source.fsr !== null && source.fsr.pm_ra !== null && source.fsr.pm_dec !== null;
            }
        ).map((source) => {
            return [source.fsr!.pm_ra, source.fsr!.pm_dec];
        });
        const field = this.field_sources.filter((source) => {
            return source.fsr !== null && source.fsr.pm_ra !== null && source.fsr.pm_dec !== null;
        }).map((source) => {
            return [source.fsr!.pm_ra, source.fsr!.pm_dec];
        });
        return {cluster: cluster, field: field};
    }

    getRa(full: boolean = false): number[] {
        const data = (full || this.cluster_sources == null) ? this.sources : this.cluster_sources;
        return data.filter(
            (source) => {
                return source.astrometry !== null && source.astrometry.ra !== null;
            }
        ).map((source) => {
            return parseFloat((source.astrometry!.ra).toFixed(2));
        }).sort((a, b) => {
            return a - b;
        });
    }

    getClusterRa(): number | null {
        const array = this.getRa();
        return array.length === 0 ? null : array[Math.floor(array.length / 2)];
    }

    getDec(full: boolean = false): number[] {
        const data = (full || this.cluster_sources == null) ? this.sources : this.cluster_sources;
        return data.filter(
            (source) => {
                return source.astrometry !== null && source.astrometry.dec !== null;
            }
        ).map((source) => {
            return parseFloat((source.astrometry!.dec).toFixed(2));
        }).sort((a, b) => {
            return a - b;
        });
    }

    getClusterDec(): number | null {
        const array = this.getDec();
        return array.length === 0 ? null : array[Math.floor(array.length / 2)];
    }

    private initValues() {
        const stored_job = this.storageService.getJob();
        if (stored_job !== null && stored_job.status === 'COMPLETED')
            if (stored_job.type === JobType.FETCH_CATALOG) {
                this.getCatalogResults(stored_job.id);
            } else if (stored_job.type === JobType.FIELD_STAR_REMOVAL) {
                this.getFSRResults(stored_job.id);
                console.log(this.sources);
            }
    }

    private generateFilterList(): FILTER[] {
        let filter_list: FILTER[] = [];
        this.sources.forEach((source) => {
            source.photometries.forEach((photometry: any) => {
                if (!filter_list.includes(photometry.filter)) {
                    filter_list.push(photometry.filter);
                }
            });
        });
        filter_list.sort((a, b) => {
            return filterWavelength[a] - filterWavelength[b];
        })
        return filter_list;
    }

}
