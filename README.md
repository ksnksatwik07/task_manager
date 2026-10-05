# Task Manager – Docker & Kubernetes Practice Project

A deliberately simple full-stack app for practicing Docker, Docker Compose and Kubernetes (Minikube).

```text
Browser → Ingress → Frontend (React + Nginx) → Backend (Node/Express) → MySQL (StatefulSet) → PVC → PV
```

| Part     | Tech                       | Container port |
|----------|----------------------------|----------------|
| Frontend | React, Vite, Nginx         | 80             |
| Backend  | Node 20, Express, mysql2   | 3000           |
| Database | MySQL 8                    | 3306           |

**How the frontend reaches the backend:** React calls the relative URL `/api/tasks`. Nginx (in the frontend container) proxies `/api/` to the backend (`backend:3000` in Compose, `task-backend:3000` in Kubernetes). The browser never talks to MySQL or directly to the backend.

API: `GET/POST /api/tasks`, `GET/PUT/DELETE /api/tasks/:id`, `GET /api/health`.

---

## 1. Run with Docker Compose

```bash
docker compose up --build
```

- Frontend: <http://localhost:8080>
- Backend API (direct): <http://localhost:3000/api/tasks>
- Stop: `Ctrl+C`, then `docker compose down` (add `-v` to also delete the DB volume).

The backend connects to `mysql:3306` (Compose service name) and retries every 3 seconds until MySQL is ready.

---

## 2. Run on Kubernetes (Minikube, Docker driver)

### 2.1 Start Minikube and Ingress
```bash
minikube start --driver=docker
minikube addons enable ingress
```

### 2.2 Build images *inside* Minikube
Minikube has its own Docker daemon. Build the images there so no registry is needed
(manifests use `imagePullPolicy: IfNotPresent`).

```bash
# Linux / macOS
eval $(minikube docker-env)
docker build -t task-backend:1.0  ./backend
docker build -t task-frontend:1.0 ./frontend
```
Windows PowerShell: `& minikube -p minikube docker-env --shell powershell | Invoke-Expression`
Alternative without switching shells: `minikube image build -t task-backend:1.0 ./backend`

### 2.3 Deploy
```bash
kubectl apply -f k8s/namespace.yaml     # namespace first
kubectl apply -f k8s/
```

### 2.4 Check
```bash
kubectl get pods -n task-manager
kubectl get svc -n task-manager
kubectl get deployments -n task-manager
kubectl get statefulsets -n task-manager
kubectl get pv
kubectl get pvc -n task-manager
kubectl get ingress -n task-manager
```
MySQL takes about 30–60 s to become `Ready`; backend Pods may restart or show `0/1` until then. That is normal.

### 2.5 Open <http://task.local>
Map the hostname `task.local` in your hosts file:

- **Linux:** `echo "$(minikube ip) task.local" | sudo tee -a /etc/hosts`
- **macOS / Windows (Docker driver):** run `minikube tunnel` in a separate terminal (keep it open) and add
  `127.0.0.1 task.local` to the hosts file (`/etc/hosts`, or `C:\Windows\System32\drivers\etc\hosts` as admin).

Quick test without hosts file: `curl -H "Host: task.local" http://$(minikube ip)/api/health` (Linux).

### 2.5.1 Cleanup
```bash
kubectl delete namespace task-manager
kubectl delete pv mysql-pv          # PV is cluster-scoped; reclaim policy is Retain
minikube ssh "sudo rm -rf /mnt/data/mysql"   # remove the stored DB files
```

---

## 3. How it works

### Service discovery & DNS (simple version)
Every Pod gets its own IP, but Pod IPs change whenever Pods are recreated. A **Service** gives a group of Pods one stable name and virtual IP. Kubernetes runs a DNS server (CoreDNS), which creates a record for each Service:

```text
mysql                                 (short name, same namespace)
mysql.task-manager                    (with namespace)
mysql.task-manager.svc.cluster.local  (fully qualified)
```

**Why `mysql:3306` works from the backend:** the name resolves via cluster DNS to the `mysql` Service, which forwards traffic to the `mysql-0` Pod.

**Why `localhost:3306` does not:** `localhost` means *"this container itself"*. Each container has its own network namespace, and the backend container is not running MySQL. The same applies to Compose: `localhost` inside `backend` is the backend container, so we use the service name `mysql`.

### Storage chain
```text
mysql-0 Pod  →  PVC (mysql-pvc)  →  PV (mysql-pv)  →  hostPath /mnt/data/mysql on the Minikube node
```
The PV is the actual storage, the PVC is a request for it, and the Pod mounts the PVC at `/var/lib/mysql`. Deleting the Pod does not delete the PVC/PV, so the data survives.

`init.sql` (mounted from the `mysql-init` ConfigMap) only runs when the data directory is **empty**, so sample tasks are not re-inserted after a restart.

### Probes
- Frontend: HTTP `/` for readiness and liveness.
- Backend: readiness = `GET /api/health` (also checks MySQL); liveness = TCP check only, so a database outage does not restart healthy backend Pods.
- MySQL: `mysqladmin ping`.

---

## 4. Kubernetes Practice Labs

### Lab 1 – Inspect Pods
```bash
kubectl get pods -n task-manager -o wide
kubectl describe pod <pod-name> -n task-manager
kubectl logs <pod-name> -n task-manager
kubectl logs -f deploy/task-backend -n task-manager
```
Look at: Events, Node, IP, Probes, Mounts, Environment.

### Lab 2 – Scale Frontend
```bash
kubectl scale deployment task-frontend --replicas=5 -n task-manager
kubectl get pods -n task-manager -l app=task-frontend
kubectl get endpoints task-frontend -n task-manager
```

### Lab 3 – Scale Backend
```bash
kubectl scale deployment task-backend --replicas=5 -n task-manager
curl -s http://task.local/api/health      # repeat: "pod" changes (load balancing)
kubectl scale deployment task-backend --replicas=2 -n task-manager
```
(5 replicas × 256Mi limit may be tight on a small Minikube; check `kubectl top pods` if the metrics addon is enabled.)

### Lab 4 – Test Kubernetes DNS
```bash
kubectl exec -it deploy/task-backend -n task-manager -- sh
# inside the Pod:
nslookup mysql
nslookup mysql.task-manager.svc.cluster.local
wget -qO- http://task-backend:3000/api/health
nc -zv mysql 3306
cat /etc/resolv.conf     # note the search domains and the CoreDNS IP
```
Why does `mysql` resolve? `/etc/resolv.conf` contains the search domain `task-manager.svc.cluster.local`, so `mysql` becomes `mysql.task-manager.svc.cluster.local`. Try `nc -zv localhost 3306` – it fails.

### Lab 5 – ConfigMap
```bash
kubectl get configmap -n task-manager
kubectl describe configmap task-config -n task-manager
kubectl exec deploy/task-backend -n task-manager -- env | grep MYSQL
```
Edit it (`kubectl edit configmap task-config -n task-manager`), then restart:
`kubectl rollout restart deployment/task-backend -n task-manager`. Env vars from a ConfigMap are read only at Pod start.

### Lab 6 – Secret
```bash
kubectl get secret task-secret -n task-manager
kubectl get secret task-secret -n task-manager -o yaml
kubectl get secret task-secret -n task-manager -o jsonpath='{.data.MYSQL_PASSWORD}' | base64 -d
```
Kubernetes stores Secret values **base64-encoded** (not encrypted) in etcd, and `stringData` is converted to `data` on save. Anyone with read access to the Secret can decode it. Real clusters add RBAC, etcd encryption at rest, or external secret managers.

### Lab 7 – PV/PVC
```bash
kubectl get pv
kubectl get pvc -n task-manager
kubectl describe pv mysql-pv
kubectl describe pvc mysql-pvc -n task-manager
```
```text
PV  (the storage)  ←bound→  PVC (the request)  ←mounted by→  Pod
```
Check STATUS is `Bound`. Peek at the files: `minikube ssh "sudo ls /mnt/data/mysql"`.

### Lab 8 – Persistence
1. Open <http://task.local> and add a task, e.g. "Persistence test".
2. Delete the MySQL Pod:
   ```bash
   kubectl delete pod mysql-0 -n task-manager
   kubectl get pods -n task-manager -w
   ```
3. Wait for `mysql-0` to be `1/1 Running` (new Pod, same name, same PVC).
4. Refresh the page: the task is still there. The backend reconnects on its own once MySQL is back.

Stretch: `kubectl delete pvc mysql-pvc -n task-manager` while Pod is running → PVC stays `Terminating` until the Pod is gone (protection finalizer). Because the PV is `Retain`, the data stays on disk.

### Lab 9 – NodePort
```bash
kubectl patch svc task-frontend -n task-manager -p '{"spec":{"type":"NodePort"}}'
kubectl get svc task-frontend -n task-manager
minikube service task-frontend -n task-manager --url
```
Revert: `kubectl patch svc task-frontend -n task-manager -p '{"spec":{"type":"ClusterIP"}}'`
(If the revert complains about `nodePort`, run `kubectl apply -f k8s/frontend-service.yaml --force` or delete and re-apply the Service.)

### Lab 10 – LoadBalancer
```bash
kubectl patch svc task-frontend -n task-manager -p '{"spec":{"type":"LoadBalancer"}}'
minikube tunnel                                  # separate terminal, keep open
kubectl get svc task-frontend -n task-manager    # EXTERNAL-IP is assigned
```
Without `minikube tunnel`, EXTERNAL-IP stays `<pending>`.

### Lab 11 – Troubleshooting
Break one thing at a time, diagnose with `get`, `describe`, `logs` and `get events`, then fix. Work on a copy (`cp k8s/backend-deployment.yaml /tmp/broken.yaml`, edit, `kubectl apply -f /tmp/broken.yaml`).

| Symptom | How to cause it | Look at | Fix |
|---|---|---|---|
| `CrashLoopBackOff` | Change backend `command` to `["node","nope.js"]`, or set `MYSQL_HOST` to a wrong value (backend exits after retries) | `kubectl logs <pod> --previous` | Restore command/config |
| `ImagePullBackOff` / `ErrImagePull` | Set image to `task-backend:does-not-exist` | `describe pod` → Events | Use an existing tag |
| `Pending` | Set `resources.requests.memory: 100Gi` | `describe pod` → "Insufficient memory" | Lower requests |
| `CreateContainerConfigError` | Point `secretKeyRef.name` to `wrong-secret` or a key that doesn't exist | `describe pod` | Fix the reference |
| `FailedMount` | In the Pod, reference `configMap: name: missing-config` as a volume, or `claimName: wrong-pvc` | `describe pod` → Events | Fix the name |
| `OOMKilled` | Set backend `limits.memory: 8Mi` | `describe pod` → Last State: `OOMKilled`, exit 137 | Raise the limit |

Handy commands:
```bash
kubectl get events -n task-manager --sort-by=.lastTimestamp
kubectl describe pod <pod> -n task-manager
kubectl logs <pod> -n task-manager --previous
kubectl get pods -n task-manager -w
```
Repair everything with `kubectl apply -f k8s/` (original manifests).

### Lab 12 – Rolling Update
```bash
# Make a visible change in backend code (e.g. change the "status" value in server.js), then:
eval $(minikube docker-env)
docker build -t task-backend:2.0 ./backend
kubectl set image deployment/task-backend backend=task-backend:2.0 -n task-manager --record=false
kubectl rollout status  deployment/task-backend -n task-manager
kubectl rollout history deployment/task-backend -n task-manager
kubectl rollout undo    deployment/task-backend -n task-manager
```
Watch Pods being replaced one by one with `kubectl get pods -n task-manager -w`. Tip: rolling back with `undo` returns the Deployment to the `task-backend:1.0` image.

---

## 5. Project structure
```text
task-manager-k8s/
├── frontend/   React + Vite, Nginx config, multi-stage Dockerfile
├── backend/    Express API (routes, controllers, db with retry)
├── mysql/      init.sql (schema + sample data, used by Compose)
├── k8s/        namespace, configmap, secret, PV, PVC, StatefulSet, Services, Deployments, Ingress
├── docker-compose.yml
└── README.md
```

## 6. Notes
- Passwords here are for **learning only**. Never commit real secrets.
- hostPath volumes are single-node and only suitable for Minikube/local clusters.
- If the Ingress returns 404/502 right after `apply`, wait until all Pods are `Ready`.
- If the Ingress controller isn't ready: `kubectl get pods -n ingress-nginx`.
