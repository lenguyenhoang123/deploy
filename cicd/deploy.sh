#!/bin/bash
jq -r 'keys[] as $k | "\($k)=\(.[$k])"' $environment_json_path > .env
sed -i 's|PROJECT-NAME|'$project_name'|' docker-compose.yaml      
sed -i 's|ENVIRONMENT-NAME|'$environment_name'|' docker-compose.yaml
sed -i 's|IMAGE-NAME|'$image_name'|' docker-compose.yaml
sed -i 's|IMAGE-TAG|'$tag'|' docker-compose.yaml
sed -i 's|P-MAPPING|'$port_mapping'|' docker-compose.yaml
sed -i 's|MOUNT-DATA-FOLDER|'$mount_data_folder'|' docker-compose.yaml
echo "$CI_REGISTRY_PW" | sudo docker login registry.gitlab.com -u "$CI_REGISTRY_USER" --password-stdin
sudo docker tag $image_name:$tag  $image_name:$img_bak_tag
sudo docker compose pull
sudo docker compose --project-name $project_name down
sudo docker compose --project-name $project_name --env-file .env up -d
