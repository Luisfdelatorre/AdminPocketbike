
import axios from 'axios';

const test = async () => {
    console.log("URI with default serializer:", axios.getUri({
        url: 'https://api.v2.megarastreo.co/mobiles',
        params: { $size: 10, $page: 1 }
    }));
};

test();
