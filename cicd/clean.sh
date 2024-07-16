export checkimage=`sudo docker images -a | grep none`
if [ -z "$checkimage" ];
    then
        echo "done"
    else
        sudo docker rmi $(sudo docker images -a | grep none | awk '{ print $3; }')
fi
